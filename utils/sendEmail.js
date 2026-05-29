const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // Mode 1: Resend API (HTTP REST) - Production Standard
  if (process.env.RESEND_API_KEY) {
    console.log(`[sendEmail] Attempting to send email to ${options.email} via Resend API...`);
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'NeighborGoods <onboarding@resend.dev>', // Resend's free sandbox domain
          to: options.email,
          subject: options.subject,
          text: options.message,
          html: options.html,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      console.log(`[sendEmail] Email successfully sent via Resend API to ${options.email}`);
      return;
    } catch (err) {
      console.error(`[sendEmail] Resend API failed: ${err.message}. Falling back to Gmail SMTP...`);
    }
  }

  // Mode 2: Gmail SMTP Fallback
  console.log(`[sendEmail] Sending email to ${options.email} via Gmail SMTP fallback...`);
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.ADMIN_EMAIL,
      pass: process.env.ADMIN_PASSWORD,
    },
    connectionTimeout: 4000, // 4 seconds
    socketTimeout: 4000,     // 4 seconds
  });

  const mailOptions = {
    from: `"NeighborGoods" <${process.env.ADMIN_EMAIL}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html, // Optional HTML content
  };

  await transporter.sendMail(mailOptions);
  console.log(`[sendEmail] Email successfully sent via Gmail SMTP to ${options.email}`);
};

module.exports = sendEmail;
