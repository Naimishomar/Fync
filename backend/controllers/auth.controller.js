import express from 'express';
import bcrypt from 'bcrypt';
import User from '../models/user.model.js';
import jwt from 'jsonwebtoken';
import { customAlphabet } from 'nanoid';
import sendMail from '../utils/emailOtp.js';
import OTP from '../models/otp.model.js';
import Notification from '../models/notification.model.js';
import { clearCache } from '../middlewares/cache.middleware.js';
import { generateAccessToken, generateRefreshToken } from '../utils/token.js';
import { deleteFromR2 } from '../utils/r2.js';
// import {sendPhoneOTP, verifyPhoneOTP } from '../utils/phoneOtp.js';

export const sendOTP = async (req, res) => {
  try {
    let { email, username, mobileNumber } = req.body;
    if (email) email = email.toLowerCase().trim();
    if (username) username = username.trim();
    if (mobileNumber) mobileNumber = mobileNumber.trim();

    if (!email || !username || !mobileNumber) {
      console.log(`DEBUG: Missing fields - email: ${!!email}, username: ${!!username}, mobileNumber: ${!!mobileNumber}`);
      return res.status(400).json({
        success: false,
        message: "Email & username or mobile number are required"
      });
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
    console.log(`DEBUG: OTP created in DB for ${email}`);
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
    console.log("DEBUG: sendAlumniOTP body:", req.body);
    let { email, username } = req.body;
    if (email) email = email.toLowerCase().trim();
    if (username) username = username.trim();

    if (!email || !username) {
      return res.status(400).json({
        success: false,
        message: "Work email and username are required"
      });
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
    console.log(`DEBUG: Alumni OTP created in DB for ${email}`);
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
    const otpDoc = await OTP.findOne({ email, otp, purpose: "alumni-register" });
    if (!otpDoc) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP"
      });
    }
    await OTP.deleteMany({ email, purpose: "alumni-register" });
    return res.status(200).json({
      success: true,
      message: "Work email verified successfully"
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
    const otpDoc = await OTP.findOne({ email, otp, purpose: "recruiter-register" });
    if (!otpDoc) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP"
      });
    }
    await OTP.deleteMany({ email, purpose: "recruiter-register" });
    return res.status(200).json({
      success: true,
      message: "Work email verified successfully"
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
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required"
      });
    }
    const otpDoc = await OTP.findOne({ email, otp });
    if (!otpDoc) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP"
      });
    }
    await OTP.deleteMany({ email });
    return res.status(200).json({
      success: true,
      message: "OTP verified successfully"
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
    return res.status(200).json({ success: true, message: "User registered successfully", token, user: newUser });
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
      isVerifiedAlumni: true,
      is_subscribed: true,
      deviceId: deviceId || null,
      deviceModel: deviceModel || "another device",
      avatar: req.file?.path || ""
    });

    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    return res.status(200).json({ success: true, message: "Alumni registered successfully", token, user: newUser });
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

    console.log("DEBUG: Incoming Recruiter payload:", { email, username, mobileNumber });

    if (!email || !username || !mobileNumber || !password || !name || !company || !role || !professionalEmail) {
      return res.status(400).json({ success: false, message: "Missing required recruiter fields" });
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
      is_subscribed: true,
      deviceId: deviceId || null,
      deviceModel: deviceModel || "another device"
    });

    console.log("DEBUG: Recruiter Created Successfully:", newUser.email);

    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    return res.status(200).json({ success: true, message: "Recruiter registered successfully", token, user: newUser });
  } catch (error) {
    console.error("Recruiter Register Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

export const login = async (req, res) => {
  try {
    let { email, password, deviceId, deviceModel } = req.body;
    if (email) email = email.toLowerCase().trim();

    console.log("DEBUG: Login Attempt for identifier:", email);

    // Look for user by email, username, mobileNumber, OR professionalEmail
    // Let's also do a case-insensitive regex search just to be 100% sure
    const user = await User.findOne({ 
      $or: [
        { email: { $regex: new RegExp("^" + email + "$", "i") } }, 
        { username: { $regex: new RegExp("^" + email + "$", "i") } }, 
        { mobileNumber: email },
        { professionalEmail: { $regex: new RegExp("^" + email + "$", "i") } }
      ] 
    });
    
    console.log("DEBUG: Database search result:", user ? `Found User ID: ${user._id}, Access: ${user.user_access}` : "NOT FOUND");
    if (!user) {
      return res.status(400).json({ success: false, message: "User not found" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Invalid credentials" });
    }

    // STRICT DEVICE BINDING CHECK (Exempt recruiters and alumni)
    if (user.user_access !== 'recruiter' && user.user_access !== 'alumni' && user.deviceId) {
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

    const userObj = user.toObject();

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

    // Clear cache for current user profile and ANY public profiling of this user
    try {
      await Promise.all([
        clearCache(`profile`), // Clears all profile related keys (private or list)
        clearCache(`${req.user.id}`), // Clears anything specifically tied to this user ID
        clearCache(`developers`)
      ]);
      console.log(`✅ Cache cleared for user update: ${req.user.id}`);
    } catch (cacheErr) {
      console.error("Cache Clear failed on Update:", cacheErr);
    }

    return res.status(200).json({ success: true, message: "User updated successfully", user: updatedUser });
  } catch (error) {
    console.error("Update Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};


export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found, please login" });
    }
    const userObj = user.toObject();
    return res.status(200).json({ success: true, message: "User fetched successfully", user: userObj });
  } catch (error) {
    console.error("Fetch Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getUserProfileByName = async (req, res) => {
  try {
    const name = req.query.q || req.body.name || req.query.name;
    if (!name) {
      return res.status(200).json({ success: true, users: [] });
    };
    const searchRegex = new RegExp(name, "i");
    const users = await User.find({ $or: [{ username: { $regex: searchRegex } }, { name: { $regex: searchRegex } }] })
      .select('_id name username avatar college year user_access')
      .limit(10);
    return res.status(200).json({ success: true, users: users });
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
      const searchRegex = new RegExp(search, "i");
      query.$or = [
        { name: { $regex: searchRegex } },
        { username: { $regex: searchRegex } },
        { company: { $regex: searchRegex } },
        { role: { $regex: searchRegex } }
      ];
    }

    const alumni = await User.find(query)
      .select('name username avatar college graduationYear company role')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const totalAlumni = await User.countDocuments(query);

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
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.status(200).json({ success: true, message: 'User fetched successfully', user });
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
    const targetUser = await User.findByIdAndUpdate(
      targetUserId,
      { $addToSet: { followers: currentUserId } },
      { new: true }
    );
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    await User.findByIdAndUpdate(
      currentUserId,
      { $addToSet: { following: targetUserId } }
    );
    if (targetUserId.toString() !== req.user.id.toString()) {
      await Notification.create({
        recipient: targetUserId,
        sender: req.user.id,
        type: 'follow'
      });
    }

    clearCache(`profile/${targetUserId}`).catch(() => { });
    clearCache(`profile/${currentUserId}`).catch(() => { });
    clearCache(`followers/${targetUserId}`).catch(() => { });
    clearCache(`following/${currentUserId}`).catch(() => { });

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
    );
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    await User.findByIdAndUpdate(
      currentUserId,
      { $pull: { following: targetUserId } }
    );

    clearCache(`profile/${targetUserId}`).catch(() => { });
    clearCache(`profile/${currentUserId}`).catch(() => { });
    clearCache(`followers/${targetUserId}`).catch(() => { });
    clearCache(`following/${currentUserId}`).catch(() => { });

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
    const user = await User.findById(req.params.id).populate('followers', '-password');
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    return res.status(200).json({ success: true, followers: user.followers });
  } catch (error) {
    console.error("Get Followers Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getFollowing = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('following', '-password');
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
    clearCache(`profile/${user._id}`).catch(() => { });
    clearCache(`profile`).catch(() => { });
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
    const user = await User.findById(decoded.id);
    if (!user) {
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
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
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
    return res.status(200).json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const verifyResetPassword = async (req, res) => {
  try {
    const { email, otp, password } = req.body;
    if (!email || !otp || !password) {
      return res.status(400).json({ success: false, message: "Email, OTP and password are required" });
    }
    if (password.length < 5) {
      return res.status(400).json({ success: false, message: "Password must be at least 5 characters long" });
    }
    const otpDoc = await OTP.findOne({ email, purpose: "reset-password" });
    if (!otpDoc) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }
    const isValidOtp = await bcrypt.compare(otp, otpDoc.otp);
    if (!isValidOtp) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await User.findOneAndUpdate(
      { email },
      { password: hashedPassword }
    );
    await OTP.deleteMany({ email, purpose: "reset-password" });
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
    console.error("Save Push Token Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

