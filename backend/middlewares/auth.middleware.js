import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export const authMiddleware = async (req, res, next) => {
  try {
    let token = null;
    if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }
    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded) {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }
    req.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      username: user.username,
      mobileNumber: user.mobileNumber,
      college: user.college,
    };
    next();
  } catch (error) {
    console.error("Auth Error:", error);
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};
