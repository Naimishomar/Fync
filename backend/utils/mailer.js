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

export const sendGeneralEmail = async (email, subject, htmlContent) => {
  try {
    const info = await transporter.sendMail({
      from: `"Fync Hiring" <${process.env.ETHEREAL_USERNAME}>`,
      to: email,
      subject: subject,
      html: htmlContent,
    });
    return info;
  } catch (error) {
    console.error("General Mail Error:", error);
    throw error;
  }
};
