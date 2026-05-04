import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const token = authHeader.split(" ")[1];
    if (!token || token === "undefined" || token === "null") {
      return res.status(401).json({
        success: false,
        message: "Malformed token",
      });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if(!user){
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isBanned) {
        return res.status(403).json({
            success: false,
            message: "Your account has been suspended for violating our terms.",
            isBanned: true
        });
    }
    req.user = {
      id: user._id.toString(),
      _id: user._id,
      name: user.name,
      email: user.email,
      username: user.username,
      mobileNumber: user.mobileNumber,
      college: user.college,
      major: user.major,
      avatar: user.avatar,
      user_access: user.user_access,
      graduationYear: user.graduationYear
    };
    next();
  } catch (error) {
    console.error("Auth Error:", error);
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

export const isAdmin = (req, res, next) => {
  if (req.user && req.user.user_access === 'admin') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin authorization required."
    });
  }
};
