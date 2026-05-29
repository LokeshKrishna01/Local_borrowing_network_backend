const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
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
};

module.exports = sendEmail;
