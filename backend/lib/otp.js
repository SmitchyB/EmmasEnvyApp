const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.BREVO_SMTP_HOST;
  const port = process.env.BREVO_SMTP_PORT;
  const user = process.env.BREVO_SMTP_USER;
  const pass = process.env.BREVO_SMTP_PASS;
  if (!host || !user || !pass) {
    return null;
  }
  transporter = nodemailer.createTransport({
    host,
    port: port ? parseInt(port, 10) : 587,
    secure: false,
    auth: { user, pass },
  });
  return transporter;
}

async function sendOtpEmail(toEmail, code) {
  const trans = getTransporter();
  if (!trans) {
    console.warn('[otp] Brevo SMTP not configured; OTP (email):', code);
    return;
  }
  await trans.sendMail({
    from: process.env.BREVO_SMTP_FROM || process.env.BREVO_SMTP_USER,
    to: toEmail,
    subject: 'Your verification code',
    text: `Your verification code is: ${code}. It expires in 10 minutes.`,
    html: `<p>Your verification code is: <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p>`,
  });
}

module.exports = { sendOtpEmail };
