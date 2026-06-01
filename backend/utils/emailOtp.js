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
      html: `
        <div style="font-family: 'Inter', Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 20px; text-align: center;">
          <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; padding: 40px 30px; border-radius: 24px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05); border: 1px solid #f1f5f9;">
            
            <div style="margin-bottom: 30px;">
              <h1 style="color: #0f172a; margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -1px;">Fync<span style="color: #f97316;">.</span></h1>
              <p style="color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px;">Security Verification</p>
            </div>
            
            <h2 style="color: #1e293b; font-size: 20px; font-weight: 700; margin-bottom: 12px;">Hello ${username},</h2>
            <p style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 30px;">
              You recently requested a one-time password to verify your account. Please use the secure code below.
            </p>
            
            <div style="background: linear-gradient(135deg, #fff7ed, #ffedd5); padding: 24px; border-radius: 16px; border: 1px solid #fed7aa; margin-bottom: 30px;">
              <p style="color: #c2410c; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 12px 0;">Verification Code</p>
              <div style="font-family: 'Courier New', Courier, monospace; font-size: 42px; font-weight: 900; color: #ea580c; letter-spacing: 8px;">${otp}</div>
            </div>
            
            <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin-bottom: 0;">
              This code is only valid for 10 minutes. If you did not request this, please ignore this email.
            </p>
          </div>
          
          <div style="margin-top: 24px;">
            <p style="color: #cbd5e1; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
              © ${new Date().getFullYear()} Fync App. All rights reserved.
            </p>
          </div>
        </div>
      `,
    });
    console.log("DEBUG: Mail sent successfully:", info.messageId);
    return info;
  } catch (error) {
    console.error("DEBUG: nodemailer Error:", error);
    throw error;
  }
};

export default sendMail;