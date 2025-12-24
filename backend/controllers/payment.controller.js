import express from "express";
import Razorpay from "razorpay";
import dotenv from "dotenv";
import crypto from "crypto";
import fs from "fs";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
dotenv.config({ quiet: true });

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const createOrder = async (req, res) => {
  try {
    console.log("Key ID:", process.env.RAZORPAY_KEY_ID);
    console.log("Key Secret:", process.env.RAZORPAY_KEY_SECRET);
    const { amount } = req.body;
    const options = {
      amount: amount * 100,
      currency: "INR",
      receipt: `receipt_${Math.floor(Math.random() * 10000)}`,
    };
    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error creating order");
  }
};

export const verifyOrder = async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    customerName,
    customerEmail,
    amount,
  } = req.body;

  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    return res.status(400).json({ success: false });
  }

  // ==========================
  //     PDF GENERATION
  // ==========================

  // Make sure receipts folder exists
  if (!fs.existsSync("./receipts")) {
    fs.mkdirSync("./receipts");
  }

  const filePath = `./receipts/${razorpay_order_id}.pdf`;
  const doc = new PDFDocument({ margin: 50 });

  // Pipe into write stream
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  // ---------- Header ----------
  doc.fontSize(24).text("Payment Receipt", { align: "center" }).moveDown();
  doc.moveDown();

  // ---------- Customer Info ----------
  doc.fontSize(16).text("Customer Details", { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(12).text(`Name: ${customerName || "N/A"}`);
  doc.text(`Email: ${customerEmail || "N/A"}`);
  doc.moveDown();

  // ---------- Payment Info ----------
  doc.fontSize(16).text("Payment Info", { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(12).text(`Order ID: ${razorpay_order_id}`);
  doc.text(`Payment ID: ${razorpay_payment_id}`);
  doc.text(`Amount: ₹${amount}`);
  doc.text(`Date: ${new Date().toLocaleString()}`);
  doc.text(`Status: SUCCESS`);
  doc.moveDown();

  // ---------- QR Code ----------
  const qrData = `Order: ${razorpay_order_id}\nPayment: ${razorpay_payment_id}\nAmount: ₹${amount}`;
  const qrImage = await QRCode.toDataURL(qrData);

  const qrBuffer = Buffer.from(qrImage.split(",")[1], "base64");
  doc.image(qrBuffer, { width: 120, align: "center" });

  doc.moveDown(2);

  // ---------- Footer ----------
  doc
    .fontSize(10)
    .text("Thank you for your purchase!", { align: "center" })
    .text(
      "This is a system-generated receipt and does not require a signature.",
      {
        align: "center",
      }
    );

  doc.end();

  stream.on("finish", () => {
    const url = `http://192.168.28.151:3000/receipts/${razorpay_order_id}.pdf`;
    res.json({
      success: true,
      receipt_url: url,
    });
    setTimeout(() => {
      fs.unlink(filePath, (err) => {
        if (err) console.error("Error deleting PDF:", err);
        else console.log("Deleted PDF:", filePath);
      });
    }, 10000);
  });
};
