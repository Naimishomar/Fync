import express from 'express';
import bcrypt from 'bcrypt';
import User from '../models/user.model.js';
import jwt from 'jsonwebtoken';
import { customAlphabet } from 'nanoid';
import sendMail from '../utils/emailOtp.js';
import {sendPhoneOTP, verifyPhoneOTP } from '../utils/phoneOtp.js';

const otpStore = {};
export const sendOTP = async (req, res) => {
  try {
    const { email, username } = req.body;
    if (!email || !username) {
      return res.status(400).json({ success: false, message: "Email & username are required" });
    }
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ success: false, message: "User already exists" });
    }
    const otp = customAlphabet('1234567890', 6)();
    otpStore[email] = otp;
    setTimeout(() => delete otpStore[email], 300000);
    await sendMail(email, otp, username);
    return res.status(200).json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    console.error("OTP Error:", error);
    return res.status(500).json({ success: false, message: "Unable to send OTP" });
  }
};

export const sendnumberOTP = async (req, res) => {
  try {
    let { mobileNumber } = req.body;
    if (!mobileNumber) {
      return res.status(400).json({ success: false, message: "Phone number required" });
    }
    mobileNumber = mobileNumber.replace(/\s|-/g, "");
    if (mobileNumber.startsWith("0")) {
      mobileNumber = mobileNumber.substring(1);
    }
    if (!mobileNumber.startsWith("+91")) {
      mobileNumber = "+91" + mobileNumber;
    }
    await sendPhoneOTP(mobileNumber);
    return res.status(200).json({ success: true, message: "OTP sent successfully", numberUsed: mobileNumber });
  } catch (error) {
    console.error("OTP Error:", error);
    return res.status(500).json({ success: false, message: "Unable to send OTP" });
  }
};

export const register = async (req, res) => {
  try {
    const { email, username, mobileNumber, password, name, dob, college, year, gender, major, userOTP, phoneOtp } = req.body;
    if (!email || !username || !mobileNumber || !password || !name || !dob || !college || !year || !gender || !major || !userOTP || !phoneOtp) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    let formattedDob = dob;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dob)) {
      const [day, month, year] = dob.split("/");
      formattedDob = new Date(`${year}-${month}-${day}`);
    }
    const storedOtp = otpStore[email];
    if (!storedOtp) {
      return res.status(400).json({ success: false, message: "Email OTP expired or was never requested" });
    }
    if (storedOtp !== String(userOTP).trim()) {
      return res.status(400).json({ success: false, message: "Invalid Email OTP" });
    }
    const twilioCheck = await verifyPhoneOTP(mobileNumber, phoneOtp);
    if (twilioCheck.status !== "approved") {
      return res.status(400).json({ success: false, message: "Invalid Mobile OTP" });
    }
    delete otpStore[email];
    const existing = await User.findOne({ $or: [{ email }, { username }, { mobileNumber }]});
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
      dob : formattedDob,
      college,
      year,
      gender,
      major,
      avatar: req.file?.path || ""
    });
    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET,{ expiresIn: "24h" });
    return res.status(200).json({ success: true, message: "User registered successfully", token, user: newUser});
  } catch (error) {
    console.error("Register Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const login = async(req,res)=>{
    try {
        const { email, password } = req.body;
        if(!email || !password){
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }
        else{
            const user = await User.findOne({ $or: [{email: email}, {username: email}, {mobileNumber: email}] });
            if(!user){
                return res.status(400).json({ success: false, message: "User not found" });
            }
            else{
                const isMatch = await bcrypt.compare(password, user.password);
                if(isMatch){
                    const token = jwt.sign({ id: user._id}, process.env.JWT_SECRET, {expiresIn: '24h'});
                    return res.status(200).json({ success: true, message: "Login successful", token, user });
                }
                else{
                    return res.status(400).json({ success: false, message: "Invalid credentials" });
                }
            }
        }
    } catch (error) {
        console.log("Server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const updateUser = async (req, res) => {
  try {
    const { about, skills, experience, interest, hobbies, github_id, linkedIn_id } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    let avatarUrl = "";
    let bannerUrl = "";
    if (req.files?.avatar) {
      avatarUrl = req.files.avatar[0].path;
    }
    if (req.files?.banner) {
      bannerUrl = req.files.banner[0].path;
    }
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      {
        $set: {
          ...(about && { about }),
          ...(skills && { skills }),
          ...(experience && { experience }),
          ...(interest && { interest }),
          ...(hobbies && { hobbies }),
          ...(github_id && { github_id }),
          ...(linkedIn_id && { linkedIn_id }),
          ...(avatarUrl && { avatar: avatarUrl }),
          ...(bannerUrl && { banner: bannerUrl }),
        },
      },
      { new: true, runValidators: true }
    ).select("-password");

    return res.status(200).json({success: true, message: "User updated successfully", user: updatedUser});
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
    return res.status(200).json({ success: true, message: "User fetched successfully", user });
  } catch (error) {
    console.error("Fetch Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getUserProfile = async (req,res)=>{
    try {
        const id = req.params.id;
        if(!id){
            return res.status(400).json({ success: false, message: 'Missing user identifier' });
        }
        const user = await User.findById(id);
        if(!user){
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
    const targetUserId = req.params.id;
    const currentUserId = req.user.id;
    if (targetUserId === currentUserId) {
      return res.status(400).json({ success: false, message: "You cannot follow yourself" });
    }
    const targetUser = await User.findById(targetUserId);
    const currentUser = await User.findById(currentUserId);
    if (!targetUser || !currentUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (targetUser.followers.includes(currentUserId)) {
      return res.status(400).json({ success: false, message: "You are already following this user" });
    }
    targetUser.followers.push(currentUserId);
    currentUser.following.push(targetUserId);
    await targetUser.save();
    await currentUser.save();
    return res.status(200).json({ success: true, message: `You are now following ${targetUser.username}`, targetUser });
  } catch (error) {
    console.error("Follow Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const unfollowUser = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user.id;

    const targetUser = await User.findById(targetUserId);
    const currentUser = await User.findById(currentUserId);
    if (!targetUser || !currentUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (!targetUser.followers.includes(currentUserId)) {
      return res.status(400).json({ success: false, message: "You are not following this user" });
    }
    targetUser.followers = targetUser.followers.filter(id => id.toString() !== currentUserId);
    currentUser.following = currentUser.following.filter(id => id.toString() !== targetUserId);

    await targetUser.save();
    await currentUser.save();
    return res.status(200).json({ success: true, message: `You unfollowed ${targetUser.username}` }, targetUser);
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