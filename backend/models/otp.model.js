import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    index: true
  },
  otp: {
    type: String,
    required: true
  },
  purpose: {
    type: String,
    enum: ["register", "login", "reset-password"],
    default: "register"
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300
  }
});

const OTP = mongoose.model("OTP", otpSchema);
export default OTP;
