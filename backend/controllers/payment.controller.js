import express from "express";
import Razorpay from "razorpay";
import dotenv from "dotenv";
import crypto from "crypto";
import fs from "fs";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import pkg from 'jimp';
const { Jimp } = pkg;
import jsQR from "jsqr";
import RegisterSpeakerSession from "../models/events/registerSpeakerSession.model.js";
import RegisterBootcamp from "../models/events/registerBootcamp.model.js";
import Community from "../models/community/community.model.js";
dotenv.config({ quiet: true });


const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const createOrder = async (req, res) => {
  try {
    const { amount, notes } = req.body;
    const options = {
      amount: amount * 100,
      currency: "INR",
      receipt: `receipt_${Math.floor(Math.random() * 10000)}`,
      notes: notes || {}
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
    merchantUpiId,
    merchantName,
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

  if (merchantName || merchantUpiId) {
    doc.fontSize(16).text("Paid To (Creator)", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Name: ${merchantName || "N/A"}`);
    doc.text(`UPI ID: ${merchantUpiId || "N/A"}`);
    doc.moveDown();
  }

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

  stream.on("finish", async () => {
    const protocol = req.protocol;
    const host = req.get('host');
    const url = `${protocol}://${host}/receipts/${razorpay_order_id}.pdf`;

    res.json({
      success: true,
      receipt_url: url,
    });

    // --- CUSTOM LOGIC FOR ECOSYSTEMS ---
    try {
      const orderDetails = await razorpay.orders.fetch(razorpay_order_id);
      if (orderDetails.notes) {
          const { type } = orderDetails.notes;
          
          if (type === 'speaker_session') {
              const { registrationId } = orderDetails.notes;
              await RegisterSpeakerSession.findByIdAndUpdate(registrationId, { isPaid: true });
          } else if (type === 'bootcamp') {
              const { registrationId } = orderDetails.notes;
              await RegisterBootcamp.findByIdAndUpdate(registrationId, { isPaid: true });
          } else if (type === 'community_spark') {
              const { communityId, plan } = orderDetails.notes;
              const CommunityDoc = await Community.findById(communityId);
              if (CommunityDoc) {
                  const now = new Date();
                  let newExpiry;
                  const daysToAdd = plan === 'yearly' ? 365 : 30;
                  
                  // Stacking check
                  if (CommunityDoc.subscription.expiryDate && new Date(CommunityDoc.subscription.expiryDate) > now) {
                      newExpiry = new Date(new Date(CommunityDoc.subscription.expiryDate).getTime() + daysToAdd * 24 * 60 * 60 * 1000);
                  } else {
                      newExpiry = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
                  }

                  CommunityDoc.subscription.expiryDate = newExpiry;
                  CommunityDoc.subscription.status = 'active';
                  CommunityDoc.subscription.lastPaymentDate = now;
                  await CommunityDoc.save();
                  console.log(`✨ Community ${communityId} renewed via HubSpark Pipeline.`);
              }
          }
      }
    } catch (updateErr) {
      console.error("Failed to update ignition status:", updateErr);
    }

    setTimeout(() => {
      fs.unlink(filePath, (err) => {
        if (err) console.error("Error deleting PDF:", err);
        else console.log("Deleted PDF:", filePath);
      });
    }, 10000);
  });
};

export const scanQRImage = async (req, res) => {
  try {
    console.log("📸 scanQRImage: Processing file...");
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: "No image provided" });
    }

    const image = await Jimp.read(req.file.buffer);
    const { width: originalWidth, height: originalHeight } = image.bitmap;
    console.log(`📸 scanQRImage: Original Dim=${originalWidth}x${originalHeight}`);

    // Helper to run jsQR with specific settings
    const attemptScan = (img, allowInversion = false) => {
      const { width, height, data } = img.bitmap;
      const clampedData = new Uint8ClampedArray(data);
      return jsQR(clampedData, width, height, {
        inversionAttempts: allowInversion ? "attemptBoth" : "dontInvert",
      });
    };

    // STAGE 1: Fast scan (Original)
    let qrCode = attemptScan(image);

    // STAGE 2: Optimized Resize (800-1000px is usually the goldilocks zone for jsQR)
    if (!qrCode && originalWidth > 1000) {
      console.log("📸 scanQRImage: Retrying with moderate resize...");
      qrCode = attemptScan(image.clone().resize({ w: 800 }));
    }

    // STAGE 3: High Contrast + Grayscale
    if (!qrCode) {
      console.log("📸 scanQRImage: Retrying with high-contrast grayscale...");
      qrCode = attemptScan(image.clone().greyscale().contrast(0.4));
    }

    // STAGE 4: Small Scan (For very busy images)
    if (!qrCode) {
      console.log("📸 scanQRImage: Retrying with low-res high-contrast...");
      qrCode = attemptScan(image.clone().resize({ w: 500 }).greyscale().contrast(0.5));
    }

    // STAGE 5: The "Kitchen Sink" (Inversion + Blur + Sharpness check)
    if (!qrCode) {
      console.log("📸 scanQRImage: Final attempt with inversion check...");
      // Some dark mode apps might invert the QR pattern
      qrCode = attemptScan(image.clone().greyscale().contrast(0.6), true);
    }

    if (qrCode) {
      console.log("✅ QR Decoded:", qrCode.data);
      return res.status(200).json({ success: true, data: qrCode.data });
    } else {
      console.log("❌ No QR detected after 5 distinct preprocessing stages.");
      return res.status(400).json({
        success: false,
        message: "No QR code could be read. Please ensure the QR is well-lit, clearly visible, and not covered by shadows."
      });
    }
  } catch (error) {
    console.error("🔥 Scan QR Error:", error);
    res.status(500).json({ success: false, message: "Failed to process the QR image. Please try another photo." });
  }
};

