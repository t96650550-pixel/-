const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendResetEmail(to, link) {
  const info = await transporter.sendMail({
    from: process.env.FROM_EMAIL,
    to,
    subject: 'Chat App - Password reset',
    text: `Reset your password: ${link}`,
    html: `<p>Reset your password: <a href="${link}">${link}</a></p>`
  });
  return info;
}

module.exports = { sendResetEmail };
