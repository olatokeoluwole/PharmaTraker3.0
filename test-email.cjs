const nodemailer = require('nodemailer');
require('dotenv').config();

async function test() {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    console.log("Verifying connection...");
    await transporter.verify();
    console.log("Connection verified!");
    
    console.log("Attempting to send email...");
    const info = await transporter.sendMail({
      from: `"Test" <${process.env.SMTP_USER}>`,
      to: "olatokeoluwole@gmail.com",
      subject: "Test Email",
      text: "This is a test email.",
    });
    console.log("Email sent successfully: " + info.messageId);
  } catch (err) {
    console.error("Error occurred:", err);
  }
}

test();
