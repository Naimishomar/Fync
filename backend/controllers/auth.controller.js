import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import User, { PUBLIC_PROFILE_FIELDS } from '../models/user.model.js';
import redisClient, { cacheGet, cacheSet } from '../utils/redis.js';
import { filterBusy } from '../utils/callState.js';
import jwt from 'jsonwebtoken';
import { customAlphabet } from 'nanoid';
import sendMail, { isValidEmail } from '../utils/emailOtp.js';
import { escapeRegExp } from '../utils/escapeRegExp.js';
import { isOtpLocked, recordOtpFail, clearOtpFails } from '../middlewares/otpLimiter.js';
import OTP from '../models/otp.model.js';
import Notification from '../models/notification.model.js';
import Post from '../models/post.model.js';
import Shorts from '../models/shorts.model.js';
import Report from '../models/report.model.js';
import Comment from '../models/comment.model.js';
import { clearCacheTags } from '../middlewares/cache.middleware.js';
import { generateAccessToken, generateRefreshToken } from '../utils/token.js';
import { deleteFromR2 } from '../utils/r2.js';
// import {sendPhoneOTP, verifyPhoneOTP } from '../utils/phoneOtp.js';

const SENSITIVE_FIELDS = ['password', 'refreshToken', 'githubAccessToken', 'deviceId', 'deviceModel'];

const sanitizeUser = (user) => {
  if (!user) return user;
  const obj = typeof user.toObject === 'function' ? user.toObject() : { ...user };
  SENSITIVE_FIELDS.forEach((f) => { delete obj[f]; });
  return obj;
};

// What a followers/following row needs: the list renders avatar, username and
// name, and `followers` drives the Follow/Following button.
const FOLLOW_LIST_FIELDS = 'name username avatar college year user_access followers';

// ─── Email verification proof ────────────────────────────────────────────────
// verify-*-otp used to answer only {success:true}, and register* never checked
// that anything had been verified, so anyone could register any address by
// skipping the OTP screens. Verifying now hands back a short-lived signed proof
// bound to the email, and register* check it.
const EMAIL_PROOF_PURPOSE = 'email-verified';

export const signEmailProof = (email) =>
  jwt.sign({ purpose: EMAIL_PROOF_PURPOSE, email }, process.env.JWT_SECRET, { expiresIn: '15m' });

// null when the request may register `email`, else the reason it may not.
// ALLOW_UNVERIFIED_REGISTER defaults on so installed apps (which do not send the
// proof yet) keep working; set it to 'false' once the new app has shipped.
export const checkEmailProof = (token, email) => {
  if (!token) {
    if (process.env.ALLOW_UNVERIFIED_REGISTER === 'false') return 'Please verify your email first';
    console.warn('register without verificationToken (allowed: ALLOW_UNVERIFIED_REGISTER is not false)');
    return null;
  }
  try {
    const p = jwt.verify(String(token), process.env.JWT_SECRET);
    if (p.purpose === EMAIL_PROOF_PURPOSE && p.email === String(email || '').toLowerCase().trim()) return null;
  } catch {
    // Expired or forged: same answer as a mismatch.
  }
  return 'Email verification expired, please verify again';
};

// Shared by every verify-*-otp: per-email lockout, single use.
const consumeOtp = async (email, otp, purpose) => {
  if (await isOtpLocked(email)) return 'Too many wrong codes. Try again in 15 minutes.';
  const otpDoc = await OTP.findOne({ email, otp, purpose });
  if (!otpDoc) {
    await recordOtpFail(email);
    return 'Invalid or expired OTP';
  }
  await OTP.deleteMany({ email, purpose });
  await clearOtpFails(email);
  return null;
};

export const sendOTP = async (req, res) => {
  try {
    let { email, username, mobileNumber } = req.body;
    if (email) email = email.toLowerCase().trim();
    if (username) username = username.trim();
    if (mobileNumber) mobileNumber = mobileNumber.trim();

    if (!email || !username || !mobileNumber) {
      return res.status(400).json({
        success: false,
        message: "Email & username or mobile number are required"
      });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Enter a valid email address" });
    }
    const existingUser = await User.findOne({ $or: [{ email }, { username }, { mobileNumber }] });
    if (existingUser) {
      let conflict = "Email";
      if (existingUser.username === username) conflict = "Username";
      if (existingUser.mobileNumber === mobileNumber) conflict = "Mobile Number";
      
      console.log(`DEBUG: Registration conflict - ${conflict} already in use`);
      return res.status(200).json({
        success: false,
        message: `${conflict} is already in use by another account.`
      });
    }
    await OTP.deleteMany({ email });
    const otp = customAlphabet("1234567890", 6)();
    await OTP.create({
      email,
      otp,
      purpose: "register"
    });
    await sendMail(email, otp, username);
    return res.status(200).json({
      success: true,
      message: "OTP sent to your email, please check"
    });
  } catch (error) {
    console.error("DEBUG: OTP Error Full:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to send OTP",
      error: error.message
    });
  }
};

export const sendAlumniOTP = async (req, res) => {
  try {
    let { email, username } = req.body;
    if (email) email = email.toLowerCase().trim();
    if (username) username = username.trim();

    if (!email || !username) {
      return res.status(400).json({
        success: false,
        message: "Work email and username are required"
      });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Enter a valid email address" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log(`DEBUG: Alumni registration conflict - Email ${email} already in use`);
      return res.status(200).json({
        success: false,
        message: "This work email is already registered with an account."
      });
    }

    await OTP.deleteMany({ email, purpose: "alumni-register" });
    const otp = customAlphabet("1234567890", 6)();
    
    await OTP.create({
      email,
      otp,
      purpose: "alumni-register"
    });
    await sendMail(email, otp, username);

    return res.status(200).json({
      success: true,
      message: "Verification OTP sent to your work email"
    });
  } catch (error) {
    console.error("DEBUG: Alumni OTP Error Full:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to send OTP",
      error: error.message
    });
  }
};

export const verifyAlumniOTP = async (req, res) => {
  try {
    let { email, otp } = req.body;
    if (email) email = email.toLowerCase().trim();
    if (otp) otp = otp.trim();
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required"
      });
    }
    const failure = await consumeOtp(email, otp, "alumni-register");
    if (failure) {
      return res.status(400).json({ success: false, message: failure });
    }
    return res.status(200).json({
      success: true,
      message: "Work email verified successfully",
      verificationToken: signEmailProof(email)
    });
  } catch (error) {
    console.error("Verify Alumni OTP Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

export const sendRecruiterOTP = async (req, res) => {
  try {
    let { email, username, mobileNumber } = req.body;
    if (email) email = email.toLowerCase().trim();
    if (username) username = username.trim();

    if (!email || !username) {
      return res.status(400).json({
        success: false,
        message: "Work email and username are required"
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Enter a valid email address" });
    }

    // Work Email Domain Validation
    const publicDomains = ['yahoo.com', 'yahoo.in', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'protonmail.com', 'zoho.com', 'rediffmail.com'];
    const domain = email.split('@')[1];
    
    if (publicDomains.includes(domain)) {
      return res.status(400).json({
        success: false,
        message: "Please use a valid company/work email. Public domains are not allowed for recruiters."
      });
    }

    const existingUser = await User.findOne({ $or: [{email}, {username}, {mobileNumber}] });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "This email, username, or phone number is already registered."
      });
    }

    await OTP.deleteMany({ email, purpose: "recruiter-register" });
    const otp = customAlphabet("1234567890", 6)();
    
    await OTP.create({
      email,
      otp,
      purpose: "recruiter-register"
    });
    
    await sendMail(email, otp, username);

    return res.status(200).json({
      success: true,
      message: "Verification OTP sent to your work email"
    });
  } catch (error) {
    console.error("Recruiter OTP Error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to send OTP",
      error: error.message
    });
  }
};

export const verifyRecruiterOTP = async (req, res) => {
  try {
    let { email, otp } = req.body;
    if (email) email = email.toLowerCase().trim();
    if (otp) otp = otp.trim();
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required"
      });
    }
    const failure = await consumeOtp(email, otp, "recruiter-register");
    if (failure) {
      return res.status(400).json({ success: false, message: failure });
    }
    return res.status(200).json({
      success: true,
      message: "Work email verified successfully",
      verificationToken: signEmailProof(email)
    });
  } catch (error) {
    console.error("Verify Recruiter OTP Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

export const verifyEmailOTP = async (req, res) => {
  try {
    let { email, otp } = req.body;
    if (email) email = String(email).toLowerCase().trim();
    if (otp) otp = String(otp).trim();
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required"
      });
    }
    // sendOTP stores the email lowercased with purpose "register"; this looked
    // up the raw email with no purpose.
    const failure = await consumeOtp(email, otp, "register");
    if (failure) {
      return res.status(400).json({ success: false, message: failure });
    }
    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      verificationToken: signEmailProof(email)
    });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};


// export const sendnumberOTP = async (req, res) => {
//   try {
//     let { mobileNumber } = req.body;
//     if (!mobileNumber) {
//       return res.status(400).json({ success: false, message: "Phone number required" });
//     }
//     mobileNumber = mobileNumber.replace(/\s|-/g, "");
//     if (mobileNumber.startsWith("0")) {
//       mobileNumber = mobileNumber.substring(1);
//     }
//     if (!mobileNumber.startsWith("+91")) {
//       mobileNumber = "+91" + mobileNumber;
//     }
//     await sendPhoneOTP(mobileNumber);
//     return res.status(200).json({ success: true, message: "OTP sent successfully", numberUsed: mobileNumber });
//   } catch (error) {
//     console.error("OTP Error:", error);
//     return res.status(500).json({ success: false, message: "Unable to send OTP" });
//   }
// };

export const register = async (req, res) => {
  try {
    const { email, username, mobileNumber, password, name, dob, college, year, gender, major, deviceId, deviceModel } = req.body;

    if (!email || !username || !mobileNumber || !password || !name || !dob || !college || !year || !gender || !major) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    const proofError = checkEmailProof(req.body.verificationToken, email);
    if (proofError) {
      return res.status(403).json({ success: false, message: proofError });
    }
    const existing = await User.findOne({ $or: [{ email }, { username }, { mobileNumber }] });
    if (existing) {
      return res.status(400).json({ success: false, message: "User already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      email,
      username,
      mobileNumber,
      password: hashedPassword,
      name,
      dob,
      college,
      year,
      gender,
      major,
      deviceId: deviceId || null,
      deviceModel: deviceModel || "another device",
      avatar: req.file?.path || ""
    });


    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    return res.status(200).json({ success: true, message: "User registered successfully", token, user: sanitizeUser(newUser) });
  } catch (error) {
    console.error("Register Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

export const registerAlumni = async (req, res) => {
  try {
    let { 
      email, username, mobileNumber, password, name, dob, college, 
      graduationYear, company, role, experienceLevel, domains, linkedIn,
      deviceId, deviceModel, gender, major 
    } = req.body;

    if (email) email = email.toLowerCase().trim();
    if (username) username = username.trim();

    if (!email || !username || !mobileNumber || !password || !name || !college || !graduationYear || !company || !role || !experienceLevel) {
      return res.status(400).json({ success: false, message: "Missing required alumni fields" });
    }
    const proofError = checkEmailProof(req.body.verificationToken, email);
    if (proofError) {
      return res.status(403).json({ success: false, message: proofError });
    }

    const existing = await User.findOne({ $or: [{ email }, { username }, { mobileNumber }] });
    if (existing) {
      return res.status(400).json({ success: false, message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      email,
      username,
      mobileNumber,
      password: hashedPassword,
      name,
      dob: dob || new Date('1990-01-01'), 
      college,
      year: graduationYear, 
      gender: gender || 'Male',
      major: major || 'Alumni',
      graduationYear,
      company,
      role,
      experienceLevel,
      domains: domains || [],
      linkedIn: linkedIn || null, 
      user_access: 'alumni',
      // Not set here: a verified work email is not a verified alumnus, and
      // is_subscribed is only ever earned through a payment.
      deviceId: deviceId || null,
      deviceModel: deviceModel || "another device",
      avatar: req.file?.path || ""
    });

    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    return res.status(200).json({ success: true, message: "Alumni registered successfully", token, user: sanitizeUser(newUser) });
  } catch (error) {
    console.error("Alumni Register Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

export const registerRecruiter = async (req, res) => {
  try {
    let { 
      email, username, mobileNumber, password, name, 
      company, role, experienceLevel, professionalEmail,
      companyWebsite, industry, companySize, linkedIn,
      deviceId, deviceModel 
    } = req.body;

    if (email) email = email.toLowerCase().trim();
    if (username) username = username.trim();
    if (professionalEmail) professionalEmail = professionalEmail.toLowerCase().trim();

    if (!email || !username || !mobileNumber || !password || !name || !company || !role || !professionalEmail) {
      return res.status(400).json({ success: false, message: "Missing required recruiter fields" });
    }
    const proofError = checkEmailProof(req.body.verificationToken, email);
    if (proofError) {
      return res.status(403).json({ success: false, message: proofError });
    }

    const existing = await User.findOne({ $or: [{ email }, { username }, { mobileNumber }] });
    if (existing) {
      return res.status(400).json({ success: false, message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      email,
      username,
      mobileNumber,
      password: hashedPassword,
      name,
      company,
      role,
      experienceLevel: experienceLevel || 'Other',
      professionalEmail,
      companyWebsite: companyWebsite || null,
      industry: industry || null,
      companySize: companySize || null,
      linkedIn: linkedIn || null, 
      user_access: 'recruiter',
      // No is_subscribed: recruiters get access by role (getSubscriptionStatus).
      deviceId: deviceId || null,
      deviceModel: deviceModel || "another device"
    });

    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    return res.status(200).json({ success: true, message: "Recruiter registered successfully", token, user: sanitizeUser(newUser) });
  } catch (error) {
    console.error("Recruiter Register Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Students are held to one device; these roles (and so the web app) may be
// signed in on several at once.
const isDeviceBound = (user) => !['recruiter', 'alumni', 'admin'].includes(user.user_access);

// Password reset revokes refresh tokens issued before it. Kept in Redis because
// non-device-bound accounts have no single stored token to clear.
// ponytail: Redis down = reset does not revoke those sessions; move to a
// tokenVersion field on User if that matters.
const REFRESH_TTL_SECONDS = 7 * 24 * 3600;
const refreshEpochKey = (id) => `refresh_epoch:${id}`;

export const login = async (req, res) => {
  try {
    let { email, password, deviceId, deviceModel } = req.body;
    if (email) email = email.toLowerCase().trim();

    const escape = escapeRegExp(email);
    const user = await User.findOne({
      $or: [
        { email: { $regex: new RegExp("^" + escape + "$", "i") } },
        { username: { $regex: new RegExp("^" + escape + "$", "i") } },
        { mobileNumber: email },
        { professionalEmail: { $regex: new RegExp("^" + escape + "$", "i") } }
      ]
    }).select('+password');
    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid credentials" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Invalid credentials" });
    }

    // STRICT DEVICE BINDING CHECK (Exempt recruiters, alumni, and admin)
    if (isDeviceBound(user) && user.deviceId) {
      if (!deviceId || user.deviceId !== deviceId) {
        return res.status(400).json({
          success: false,
          color: "red", // UI hint
          message: `This account is already logged into ${user.deviceModel || 'another device'}. Students are restricted to a single device for security.`
        });
      }
    }



    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    if (deviceId) {
      user.deviceId = deviceId;
      user.deviceModel = deviceModel || "Unknown Device";
    }
    await user.save();

    const userObj = sanitizeUser(user);

    res.status(200).json({ message: "Login successful", success: true, token: accessToken, refreshToken, user: userObj });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { 
      name, username, bio, about, skills, experience, interest, hobbies, 
      github_id, linkedIn_id, leetcode, gfg, codechef, codeforces, hackerrank, upiId,
      company, role, industry, companySize, companyWebsite, college 
    } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    let avatarUrl = "";
    let bannerUrl = "";
    let resumeUrlStr = "";
    let resumeNameStr = "";

    if (req.files?.avatar) {
      if (user.avatar) {
        await deleteFromR2(user.avatar);
      }
      avatarUrl = req.files.avatar[0].path;
    }
    if (req.files?.banner) {
      if (user.banner) {
        await deleteFromR2(user.banner);
      }
      bannerUrl = req.files.banner[0].path;
    }
    if (req.files?.resume) {
      if (user.resumeUrl) {
        await deleteFromR2(user.resumeUrl);
      }
      resumeUrlStr = req.files.resume[0].path;
      resumeNameStr = req.files.resume[0].originalname || 'resume.pdf';
    }
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      {
        $set: {
          ...(name && { name }),
          ...(username && { username }),
          ...(bio && { bio }),
          ...(about && { about }),
          ...(skills && { skills }),
          ...(experience && { experience }),
          ...(interest && { interest }),
          ...(hobbies && { hobbies }),
          ...(github_id && { github_id }),
          ...(linkedIn_id && { linkedIn_id }),
          ...(avatarUrl && { avatar: avatarUrl }),
          ...(bannerUrl && { banner: bannerUrl }),
          ...(leetcode && { "codingProfiles.leetcode": leetcode }),
          ...(gfg && { "codingProfiles.gfg": gfg }),
          ...(codechef && { "codingProfiles.codechef": codechef }),
          ...(codeforces && { "codingProfiles.codeforces": codeforces }),
          ...(hackerrank && { "codingProfiles.hackerrank": hackerrank }),
          ...(upiId && { upiId }),
          ...(resumeUrlStr && { resumeUrl: resumeUrlStr }),
          ...(resumeNameStr && { resumeName: resumeNameStr }),
          // Recruiter / Alumni fields
          ...(company && { company }),
          ...(role && { role }),
          ...(industry && { industry }),
          ...(companySize && { companySize }),
          ...(companyWebsite && { companyWebsite }),
          ...(college && { college }),
        },
      },
      { new: true, runValidators: true }
    ).select("-password");

    // A profile edit changes this user's profile page, their post/short listings
    // (author name and avatar are embedded there) and the alumni directory.
    await clearCacheTags([
      `profile:${req.user.id}`,
      `posts:user:${req.user.id}`,
      `shorts:user:${req.user.id}`,
      'posts',
      'shorts',
      'alumni',
    ]);

    return res.status(200).json({ success: true, message: "User updated successfully", user: updatedUser });
  } catch (error) {
    console.error("Update Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};


import { checkAndResetStreak } from '../utils/streak.js';
import { invalidatePresenceAudience } from '../utils/presence.js';

export const getProfile = async (req, res) => {
  try {
    let user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found, please login" });
    }
    
    // Lazy reset streak if missed
    user = await checkAndResetStreak(user);

    const userObj = sanitizeUser(user);
    return res.status(200).json({ success: true, message: "User fetched successfully", user: userObj });
  } catch (error) {
    console.error("Fetch Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getUserProfileByName = async (req, res) => {
  try {
    const raw = req.query.q || req.body.name || req.query.name;
    const name = String(raw || "").trim();
    if (!name) {
      return res.status(200).json({ success: true, users: [] });
    }
    // A one-character query matches most of the collection and returns an
    // arbitrary ten of them, which reads as "search is broken".
    if (name.length < 2) {
      return res.status(200).json({ success: true, users: [] });
    }

    const escaped = escapeRegExp(name);
    // ponytail: unanchored regex, so this is a collection scan. Fine at current
    // size; if it shows up in profiling, switch to a text index on
    // {username, name} or an anchored ^prefix match, both of which are indexable.
    const searchRegex = new RegExp(escaped, "i");
    const users = await User.find({
      _id: { $ne: req.user.id },
      $or: [{ username: { $regex: searchRegex } }, { name: { $regex: searchRegex } }]
    })
      .select('_id name username avatar college year user_access')
      .limit(20)
      .lean();

    // Prefix matches first: typing "sam" should surface @sam before @rosamund.
    const prefix = new RegExp("^" + escaped, "i");
    users.sort((a, b) => {
      const rank = (u) => (prefix.test(u.username || "") ? 0 : prefix.test(u.name || "") ? 1 : 2);
      return rank(a) - rank(b);
    });

    return res.status(200).json({ success: true, users: users.slice(0, 10) });
  } catch (error) {
    console.log("Search error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getAlumniByCollege = async (req, res) => {
  try {
    const { college } = req.user;
    if (!college) {
      return res.status(400).json({ success: false, message: "College information missing in your profile" });
    }

    const { page = 1, limit = 10, search = "", batch = "" } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {
      college: college,
      user_access: 'alumni',
      _id: { $ne: req.user.id }
    };

    if (batch) {
      query.graduationYear = batch;
    }

    if (search) {
      const searchRegex = new RegExp(escapeRegExp(search), "i");
      query.$or = [
        { name: { $regex: searchRegex } },
        { username: { $regex: searchRegex } },
        { company: { $regex: searchRegex } },
        { role: { $regex: searchRegex } }
      ];
    }

    // These two do not depend on each other; they were awaited in sequence, so
    // every page of the alumni directory cost two serial round trips.
    const [alumni, totalAlumni] = await Promise.all([
      User.find(query)
        .select('name username avatar college graduationYear company role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      alumni,
      pagination: {
        total: totalAlumni,
        page: parseInt(page),
        pages: Math.ceil(totalAlumni / parseInt(limit))
      }
    });
  } catch (error) {
    console.error("Error fetching alumni:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};


export const getUserProfile = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Missing user identifier' });
    }
    // Anyone but the owner gets the public allow-list. This used to return the
    // whole document: email, phone, dob, push tokens, addresses, UPI id.
    const isOwner = String(req.user?.id) === String(id);
    const query = User.findById(id);
    if (!isOwner) query.select(PUBLIC_PROFILE_FIELDS);
    let user = await query;
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Lazily reset streak if the user missed a day, so viewers see accurate streaks
    user = await checkAndResetStreak(user);

    return res.status(200).json({ success: true, message: 'User fetched successfully', user: sanitizeUser(user) });
  } catch (error) {
    console.log("Internal server error", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

export const followUser = async (req, res) => {
  try {
    const { id: targetUserId } = req.params;
    const currentUserId = req.user.id;
    if (!targetUserId || !currentUserId) {
      return res.status(401).json({ success: false, message: "Please login first" });
    }
    if (targetUserId.toString() === currentUserId.toString()) {
      return res.status(400).json({ success: false, message: "You cannot follow yourself" });
    }
    // Only treat this as a NEW follow when the edge did not already exist —
    // otherwise every repeat tap sent another notification.
    const edge = await User.updateOne(
      { _id: targetUserId, followers: { $ne: currentUserId } },
      { $addToSet: { followers: currentUserId } }
    );
    const isNewFollow = edge.modifiedCount > 0;

    // Projected: this is echoed back to the follower.
    const targetUser = await User.findById(targetUserId).select(FOLLOW_LIST_FIELDS);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    await User.findByIdAndUpdate(
      currentUserId,
      { $addToSet: { following: targetUserId } }
    );
    if (isNewFollow && targetUserId.toString() !== req.user.id.toString()) {
      await Notification.create({
        recipient: targetUserId,
        sender: req.user.id,
        type: 'follow'
      });
    }

    clearCacheTags([
      `profile:${targetUserId}`, `profile:${currentUserId}`,
      `followers:${targetUserId}`, `following:${currentUserId}`,
    ]).catch(() => { });
    // The follow graph decides who sees this user's online status.
    invalidatePresenceAudience(targetUserId);
    invalidatePresenceAudience(currentUserId);

    return res.status(200).json({
      success: true,
      message: `You are now following ${targetUser.username}`,
      targetUser
    });
  } catch (error) {
    console.error("Follow Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const unfollowUser = async (req, res) => {
  try {
    const { id: targetUserId } = req.params;
    const currentUserId = req.user.id;
    const targetUser = await User.findByIdAndUpdate(
      targetUserId,
      { $pull: { followers: currentUserId } },
      { new: true }
    ).select(FOLLOW_LIST_FIELDS);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    await User.findByIdAndUpdate(
      currentUserId,
      { $pull: { following: targetUserId } }
    );

    clearCacheTags([
      `profile:${targetUserId}`, `profile:${currentUserId}`,
      `followers:${targetUserId}`, `following:${currentUserId}`,
    ]).catch(() => { });
    // The follow graph decides who sees this user's online status.
    invalidatePresenceAudience(targetUserId);
    invalidatePresenceAudience(currentUserId);

    return res.status(200).json({
      success: true,
      message: `You unfollowed ${targetUser.username}`,
      targetUser
    });
  } catch (error) {
    console.error("Unfollow Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};


export const getFollowers = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('followers', FOLLOW_LIST_FIELDS);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    return res.status(200).json({ success: true, followers: user.followers });
  } catch (error) {
    console.error("Get Followers Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getFollowing = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('following', FOLLOW_LIST_FIELDS);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    return res.status(200).json({ success: true, following: user.following });
  } catch (error) {
    console.error("Get Following Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const logout = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found, please login" });
    }
    user.refreshToken = null;
    user.deviceId = null;
    user.deviceModel = null;
    await user.save();
    clearCacheTags([`profile:${user._id}`]).catch(() => { });
    return res.status(200).json({ success: true, message: "User logged out successfully" });
  } catch (error) {
    console.log("Internal server error", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}


export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ success: false });
    }
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id).select('+refreshToken');
    // Device-bound (student) accounts: only the token issued at the latest
    // login is live. Logout, a password reset or a login elsewhere
    // clears/replaces it, and the old one dies here instead of minting access
    // tokens for its full 7 days. Other roles keep every device signed in;
    // only a password reset (refresh epoch) ends their sessions.
    const epoch = user && !isDeviceBound(user) ? Number(await cacheGet(refreshEpochKey(user._id))) : 0;
    if (!user || user.isBanned ||
        (isDeviceBound(user) ? user.refreshToken !== refreshToken : decoded.iat <= epoch)) {
      return res.status(401).json({
        success: false,
        message: "Logged in on another device",
      });
    }
    const newAccessToken = generateAccessToken(user._id);
    res.json({ success: true, token: newAccessToken });
  } catch {
    res.status(401).json({ success: false });
  }
};

export const resetPassword = async (req, res) => {
  try {
    let { email } = req.body;
    if (email) email = email.toLowerCase().trim();

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }
    // Same answer whether or not the account exists, so this cannot be used to
    // check who is registered.
    const sent = { success: true, message: "If an account exists for this email, an OTP has been sent" };
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(200).json(sent);
    }
    await OTP.deleteMany({ email, purpose: "reset-password" });
    const otp = customAlphabet("1234567890", 6)();
    const hashedOtp = await bcrypt.hash(otp, 10);
    await sendMail(email, otp, user.username);
    await OTP.create({
      email,
      otp: hashedOtp,
      purpose: "reset-password"
    });
    return res.status(200).json(sent);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const verifyResetPassword = async (req, res) => {
  try {
    let { email, otp, password } = req.body;
    if (email) email = String(email).toLowerCase().trim();
    if (!email || !otp || !password) {
      return res.status(400).json({ success: false, message: "Email, OTP and password are required" });
    }
    if (password.length < 5) {
      return res.status(400).json({ success: false, message: "Password must be at least 5 characters long" });
    }
    if (await isOtpLocked(email)) {
      return res.status(429).json({ success: false, message: "Too many wrong codes. Try again in 15 minutes." });
    }
    const otpDoc = await OTP.findOne({ email, purpose: "reset-password" });
    if (!otpDoc) {
      await recordOtpFail(email);
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }
    const isValidOtp = await bcrypt.compare(String(otp), otpDoc.otp);
    if (!isValidOtp) {
      await recordOtpFail(email);
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    // A reset is what you do when someone else may have your password, so it
    // also ends every existing session.
    const reset = await User.findOneAndUpdate(
      { email },
      { password: hashedPassword, refreshToken: null }
    );
    if (reset) await cacheSet(refreshEpochKey(reset._id), REFRESH_TTL_SECONDS, String(Math.floor(Date.now() / 1000)));
    await OTP.deleteMany({ email, purpose: "reset-password" });
    await clearOtpFails(email);
    return res.status(200).json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
export const savePushToken = async (req, res) => {
  try {
    const { pushToken } = req.body;
    if (!pushToken) {
      return res.status(400).json({ success: false, message: "Push token is required" });
    }
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { expoPushToken: pushToken },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    return res.status(200).json({ success: true, message: "Push token saved successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /user/admin/stats — how many people are actually on Fync.
 *
 * Counted per request rather than stored: countDocuments on an indexed field
 * is cheap, and a cached total that drifts is worse than no total at all.
 */
export const getUserStatsForAdmin = async (req, res, next) => {
  try {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [total, students, alumni, recruiters, banned, newToday, newThisWeek] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ user_access: 'user' }),
      User.countDocuments({ user_access: 'alumni' }),
      User.countDocuments({ user_access: 'recruiter' }),
      User.countDocuments({ isBanned: true }),
      User.countDocuments({ createdAt: { $gte: dayAgo } }),
      User.countDocuments({ createdAt: { $gte: weekAgo } }),
    ]);

    res.json({
      success: true,
      stats: { total, students, alumni, recruiters, banned, newToday, newThisWeek },
    });
  } catch (err) {
    next(err);
  }
};

export const getUsersForAdmin = async (req, res) => {
  try {
    if (req.user.user_access !== 'admin') {
        return res.status(403).json({ success: false, message: "Unauthorized." });
    }

    const { search = "" } = req.query;
    
    if (!search || search.trim() === "") {
        return res.status(200).json({ success: true, users: [] });
    }

    const safe = escapeRegExp(search.trim());
    const query = { $or: [{ name: { $regex: safe, $options: "i" } }, { username: { $regex: safe, $options: "i" } }, { email: { $regex: safe, $options: "i" } }] };
    
    const users = await User.find(query)
      .select('name username email avatar isBanned user_access createdAt')
      .sort({ createdAt: -1 })
      .limit(50);
      
    return res.status(200).json({ success: true, users });
  } catch (error) {
    console.error("Get Users Admin Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Removes a user and what they made. Shared by an admin ban and by the owner
// deleting their own account (Play Store requirement), so both stay complete.
// findByIdAndDelete (not deleteOne) so the model hook drops the auth cache and
// a still-valid access token stops working at once.
// ponytail: chats (Supabase), projects/certs, interviews, marketplace and
// community rows are not swept yet; add them here when they need to go.
//
// selfDelete keeps reports filed *against* the user (and their content): a
// user deleting their account must not wipe the evidence. Only the reports
// they filed go. An admin ban has already acted on them, so it clears all.
export const purgeUser = async (user, { selfDelete = false } = {}) => {
    const userId = user._id;
    // Read before the deletes below: reports on this user's shorts go too,
    // or the admin queue keeps rows pointing at content that no longer exists.
    const [userPosts, userShorts] = await Promise.all([
        mongoose.model('Post').find({ user: userId }).distinct('_id'),
        mongoose.model('Shorts').find({ user: userId }).distinct('_id'),
    ]);
    const reports = selfDelete
        ? { reporter: userId }
        : { $or: [{ reporter: userId }, { targetUser: userId }, { post: { $in: userPosts } }, { short: { $in: userShorts } }] };

    // Content first, the User last: if any of these fails the account still
    // exists and the delete can simply be retried.
    await Promise.all([
        mongoose.model('Post').deleteMany({ user: userId }),
        mongoose.model('Shorts').deleteMany({ user: userId }),
        mongoose.model('Report').deleteMany(reports),
        // The author field is `commentor`; this filtered on `user`, which does
        // not exist, so it never deleted a single comment. Also sweeps the
        // threads under the posts/shorts being deleted.
        // ponytail: comment counters on other people's posts are not decremented.
        mongoose.model('Comment').deleteMany({ $or: [{ commentor: userId }, { post: { $in: [...userPosts, ...userShorts] } }] }),
        mongoose.model('Notification').deleteMany({ $or: [{ recipient: userId }, { sender: userId }] }),
        // Otherwise every follower count still includes a user who is gone.
        User.updateMany(
            { $or: [{ followers: userId }, { following: userId }] },
            { $pull: { followers: userId, following: userId } }
        ),
    ]);
    await User.findByIdAndDelete(userId);

    // Skip the schema defaults: shared placeholder URLs, not this user's files.
    const owned = ['avatar', 'banner', 'resumeUrl']
        .filter((f) => user[f] && user[f] !== User.schema.path(f).defaultValue)
        .map((f) => user[f]);
    await Promise.all(owned.map((u) => deleteFromR2(u)));
    clearCacheTags([`profile:${userId}`, 'posts', 'shorts']).catch(() => { });
};

// DELETE /user/me  body {confirm:"DELETE"}
export const deleteAccount = async (req, res) => {
  try {
    if (req.body?.confirm !== 'DELETE') {
      return res.status(400).json({ success: false, message: 'Send confirm: "DELETE" to delete your account' });
    }
    const user = await User.findById(req.user.id).select('avatar banner resumeUrl');
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    await purgeUser(user, { selfDelete: true });
    return res.status(200).json({ success: true, message: "Your account and its data have been deleted." });
  } catch (error) {
    console.error("Delete Account Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const banUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isBanned } = req.body;

    // Double check admin privileges (defense in depth)
    if (req.user.user_access !== 'admin') {
        return res.status(403).json({ success: false, message: "Unauthorized. Admin access required." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.user_access === 'admin') {
      return res.status(400).json({ success: false, message: "Cannot ban an administrator" });
    }

    if (isBanned) {
        await purgeUser(user);

        return res.status(200).json({ 
            success: true, 
            message: "User profile and all associated data have been permanently deleted and banned.",
            isDeleted: true
        });
    }
    user.isBanned = isBanned;
    await user.save();

    return res.status(200).json({ 
        success: true, 
        message: isBanned ? "User has been banned" : "User has been unbanned",
        isBanned: user.isBanned
    });
  } catch (error) {
    console.error("Ban User Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const verifyAdminPassword = async (req, res) => {
  try {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PANEL_PASSWORD;

    if (!adminPassword) {
      return res.status(500).json({ success: false, message: "Server misconfiguration: Admin password not set in environment." });
    }

    if (typeof password !== 'string' || password.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid admin password" });
    }

    const supplied = Buffer.from(password);
    const expected = Buffer.from(adminPassword);
    const isMatch = supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);

    if (isMatch) {
      return res.status(200).json({ success: true, message: "Access granted" });
    }
    return res.status(401).json({ success: false, message: "Invalid admin password" });
  } catch (error) {
    console.error("Verify Admin Password Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const updateFcmToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) {
      return res.status(400).json({ success: false, message: "FCM token is required" });
    }
    
    // Add token if it doesn't exist in array
    await User.findByIdAndUpdate(
      req.user.id,
      { $addToSet: { fcmTokens: fcmToken } }
    );
    
    return res.status(200).json({ success: true, message: "FCM token registered" });
  } catch (error) {
    console.error("FCM Token Error:", error);
    return res.status(500).json({ success: false, message: "Failed to register FCM token" });
  }
};

export const getUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const redisClient = (await import('../utils/redis.js')).default;
    
    const isOnline = await redisClient.sIsMember('global_online_users', userId);
    
    res.json({ 
      success: true, 
      online: isOnline,
      userId 
    });
  } catch (error) {
    console.error("Get User Status Error:", error);
    res.status(500).json({ success: false, message: "Failed to get user status" });
  }
};

export const getOnlineUsers = async (req, res) => {
  try {
    const currentUserId = String(req.user?.id || "");
    const { mode } = req.query;   // 'audio' | 'video'

    // Both lobbies used to read app-wide presence, so anyone with the app open
    // appeared in the audio room AND the video room at the same time — which is
    // not a state a person can actually be in. Presence is now scoped to the
    // lobby the user is standing in.
    const onlineUserIds = (
      mode === 'audio' || mode === 'video'
        ? await redisClient.sMembers(`call_lobby:${mode}`)
        : await redisClient.sMembers('global_online_users')
    ).filter(id => id !== currentUserId);

    if (onlineUserIds.length === 0) {
      return res.json({ success: true, users: [] });
    }

    // `profilePic` is not a field on the user schema -- it is `avatar`. The
    // select silently returned nothing for it, which is why every row in the
    // call lobby rendered a placeholder initial instead of a photo.
    const [users, busy] = await Promise.all([
      User.find({ _id: { $in: onlineUserIds } })
        .select('_id name username avatar college')
        .limit(200)
        .lean(),
      // Real busy state, not a hardcoded 'online'. Without this the lobby
      // showed everyone as free and let you ring someone mid-conversation.
      filterBusy(onlineUserIds),
    ]);

    const usersWithStatus = users.map(u => ({
      ...u,
      status: busy.has(String(u._id)) ? 'busy' : 'online',
    }));

    // Free users first, then alphabetical -- the list is for picking someone
    // to call, so the callable ones belong at the top.
    usersWithStatus.sort((a, b) =>
      (a.status === b.status ? 0 : a.status === 'online' ? -1 : 1) ||
      String(a.name || '').localeCompare(String(b.name || ''))
    );

    res.json({ success: true, users: usersWithStatus });
  } catch (error) {
    console.error("Get Online Users Error:", error);
    res.status(500).json({ success: false, message: "Failed to get online users" });
  }
};
