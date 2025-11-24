import express from 'express';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config({quiet: true});

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.ETHEREAL_USERNAME,
    pass: process.env.ETHEREAL_PASSWORD,
  },
});

const sendMail = async (email, otp, username) => {
  console.log("MAIL SEND OTP:", otp);
  await transporter.sendMail({
    from: `"Fync" <${process.env.ETHEREAL_USERNAME}>`,
    to: email,
    subject: `OTP Fync App: ${otp}`,
    html: `<h2>Hello ${username}, your OTP is for Fync App: ${otp}</h2>`,
  });
};

export default sendMail;