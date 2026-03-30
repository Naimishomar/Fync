import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config({quiet: true});

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: (process.env.ETHEREAL_USERNAME || "").trim(),
    pass: (process.env.ETHEREAL_PASSWORD || "").trim(),
  },
});

const sendMail = async (email, otp, username) => {
  console.log(`DEBUG: Attempting to send mail to ${email} for ${username}, OTP: ${otp}`);
  try {
    const info = await transporter.sendMail({
      from: `"Fync" <${process.env.ETHEREAL_USERNAME}>`,
      to: email,
      subject: `OTP Fync App: ${otp}`,
      html: `<h2>Hello ${username}, your OTP is for Fync App: ${otp}</h2>`,
    });
    console.log("DEBUG: Mail sent successfully:", info.messageId);
    return info;
  } catch (error) {
    console.error("DEBUG: nodemailer Error:", error);
    throw error;
  }
};

export default sendMail;