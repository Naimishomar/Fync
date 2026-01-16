import express from 'express';
import bcrypt from 'bcrypt';
import User from '../models/user.model.js';
import jwt from 'jsonwebtoken';
import { customAlphabet } from 'nanoid';
import sendMail from '../utils/emailOtp.js';
import OTP from '../models/otp.model.js';
import Notification from '../models/notification.model.js';
import { generateAccessToken, generateRefreshToken } from '../utils/token.js';
// import {sendPhoneOTP, verifyPhoneOTP } from '../utils/phoneOtp.js';

export const sendOTP = async (req, res) => {
  try {
    console.log(req.body);
    const { email, username, mobileNumber } = req.body;
    if (!email || !username|| !mobileNumber) {
      return res.status(400).json({
        success: false,
        message: "Email & username or mobile number are required"
      });
    }
    const existingUser = await User.findOne({ $or: [{ email }, { username }, { mobileNumber }]});
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists"
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
      message: "OTP sent successfully"
    });
  } catch (error) {
    console.error("OTP Error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to send OTP"
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
    const {
      email,
      username,
      mobileNumber,
      password,
      name,
      dob,
      college,
      year,
      gender,
      major,
    } = req.body;
    if (!email || !username || !mobileNumber || !password || !name || !dob || !college || !year || !gender || !major) {
      return res.status(400).json({ success: false,message: "Missing required fields"});
    }
    const existing = await User.findOne({ $or: [{ email }, { username }, { mobileNumber }]});
    if (existing) {
      return res.status(400).json({success: false,message: "User already exists"});
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
      avatar: req.file?.path || ""
    });
    const token = jwt.sign({ id: newUser._id },process.env.JWT_SECRET,{ expiresIn: "7d" });
    return res.status(200).json({ success: true, message: "User registered successfully",token,user: newUser});
  } catch (error) {
    console.error("Register Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ $or: [{ email }, { username: email }, { mobileNumber: email }],});
    if (!user) {
      return res.status(400).json({ success: false, message: "User not found" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Invalid credentials" });
    }
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    user.refreshToken = refreshToken;
    await user.save();

    res.status(200).json({ message:"Login successful", success: true, token: accessToken,refreshToken,user});
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { about, skills, experience, interest, hobbies, github_id, linkedIn_id, leetcode, gfg } = req.body;
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
          ...(leetcode && { "codingProfiles.leetcode": leetcode }),
          ...(gfg && { "codingProfiles.gfg": gfg }),
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

export const getUserProfileByName = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(200).json({ success: true, users: [] });
    };
    const searchRegex = new RegExp(name, "i");
    const users = await User.find({ $or: [{ username: { $regex: searchRegex } },{ name: { $regex: searchRegex } }]})
    .limit(10);
    return res.status(200).json({ success: true, users: users});
  } catch (error) {
    console.log("Search error:", error);
    return res.status(500).json({ success: false,  message: "Internal server error" });
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

export const logout = async(req,res)=>{
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found, please login" });
    }
    user.refreshToken = null;
    await user.save();
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
    const decoded = jwt.verify(refreshToken,process.env.JWT_REFRESH_SECRET);
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
