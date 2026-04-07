// utils/emailService.js
const { Resend } = require('resend');

// 🔍 Debug Resend env on server start
console.log('📧 RESEND CONFIG:', {
  hasApiKey: !!process.env.RESEND_API_KEY,
});

// Create Resend client
let resend = null;

if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
} else {
  console.warn(
    '⚠️  RESEND_API_KEY not set. Emails will NOT be sent.'
  );
}

async function sendVerificationEmail(to, token) {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
  const verifyUrl = `${backendUrl}/api/auth/verify-email/${token}`;

  // Use Resend onboarding sender (no custom domain needed)
  const from = 'onboarding@resend.dev';
  const subject = 'Verify your email for FailFixes';

  const html = `
    <p>Thanks for signing up to <strong>FailFixes</strong>!</p>
    <p>Please verify your email by clicking the link below:</p>
    <p><a href="${verifyUrl}">Verify my email</a></p>
    <p>If the button doesn't work, copy and paste this link into your browser:</p>
    <p>${verifyUrl}</p>
  `;

  if (!resend) {
    console.warn(
      '📧 sendVerificationEmail called but RESEND_API_KEY is not configured. ' +
        'Skipping send. Would send to:',
      to,
      'with URL:',
      verifyUrl
    );
    return;
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
    });

    if (error) {
      console.error('❌ Resend email error:', error);
      // Do NOT break signup just because email failed
      return;
    }

    console.log('📧 Verification email sent via Resend:', {
      to,
      id: data?.id,
    });
  } catch (err) {
    console.error('❌ Error sending verification email (Resend):', err.message);
    // Also do not rethrow here so signup stays 201
  }
}

module.exports = {
  sendVerificationEmail,
};
