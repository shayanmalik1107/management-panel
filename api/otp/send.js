import nodemailer from 'nodemailer';

// Sanitizes email for Firebase RTDB path
function sanitizeEmail(email) {
  return String(email || '').trim().toLowerCase().replace(/[\.\#\$\[\]]/g, '_');
}

export default async function handler(req, res) {
  // Enable CORS for mobile app & web clients
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const rawEmail = req.body?.email || req.body?.phone;
    const uid = req.body?.uid;

    if (!rawEmail) {
      return res.status(400).json({ success: false, error: 'Email address is required' });
    }

    const normalized = String(rawEmail).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalized)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address (e.g. name@example.com)' });
    }

    // Disposable/Burner email detection
    const domain = normalized.split('@')[1] || '';
    const blockedDomains = [
      'tempmail.com', 'guerrillamail.com', '10minutemail.com', 'mailinator.com',
      'throwawaymail.com', 'yopmail.com', 'getnada.com', 'fakemailgenerator.com',
      'trashmail.com', 'dispostable.com', 'sharklasers.com', 'guerrillamailblock.com',
      'mohmal.com', 'burnermail.io', 'inboxkitten.com', 'nada.ltd', 'crazymailing.com'
    ];
    if (blockedDomains.some(d => domain === d || domain.endsWith('.' + d))) {
      return res.status(400).json({
        success: false,
        error: 'Disposable burner emails are not permitted. Please use your authentic personal or business email.'
      });
    }

    const sanitized = sanitizeEmail(normalized);

    // Check if email already claimed a trial in Firebase RTDB
    try {
      const claimedResp = await fetch(`https://panel-adefe-default-rtdb.firebaseio.com/system_claimed_trial_emails/${sanitized}.json`);
      const claimedData = await claimedResp.json();
      if (claimedData) {
        return res.status(400).json({
          success: false,
          error: 'This email address has already claimed a 3-Day Free Trial. Each email is limited to 1 trial account.'
        });
      }
    } catch (checkErr) {
      console.warn('[OTP send] Firebase check error:', checkErr);
    }

    // Generate 6-digit OTP code
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP record in Firebase RTDB
    try {
      await fetch(`https://panel-adefe-default-rtdb.firebaseio.com/system_trial_otps/${sanitized}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          otp,
          email: normalized,
          uid: uid || null,
          expiresAt,
          createdAt: Date.now()
        })
      });
    } catch (dbErr) {
      console.error('[OTP send] Failed to persist OTP to Firebase:', dbErr);
    }

    // Configure SMTP Transporter (fallback to configured Gmail credentials)
    const user = process.env.SMTP_USER || 'lambapkcom@gmail.com';
    const pass = process.env.SMTP_PASS || 'adufvxhjhxcnsixo';
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const fromAddress = process.env.SMTP_FROM || 'LAMBA Business Support <lambapkcom@gmail.com>';

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: { rejectUnauthorized: false }
    });

    const mailOptions = {
      from: fromAddress,
      to: normalized,
      subject: `Your LAMBA Free Trial Verification Code: ${otp}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; color: #0f172a;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="margin: 0; color: #2563eb; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">LAMBA Business Management</h2>
            <p style="margin: 6px 0 0 0; color: #64748b; font-size: 14px;">3-Day Free Trial Activation Code</p>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <p style="margin: 0 0 12px 0; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Your One-Time Verification Code</p>
            <div style="font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #2563eb; font-family: monospace; padding: 8px 16px; background: #eff6ff; border-radius: 10px; display: inline-block;">
              ${otp}
            </div>
            <p style="margin: 12px 0 0 0; color: #94a3b8; font-size: 12px;">This code expires in 10 minutes. Do not share it with anyone.</p>
          </div>
          <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
            Enter this code into your screen to instantly unlock your 3-day full access to inventory, customer ledgers, order tracking, and invoicing.
          </p>
          <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; text-align: center; color: #94a3b8; font-size: 12px;">
            If you did not request this trial, you can safely ignore this email.
          </div>
        </div>
      `,
      text: `Your LAMBA Free Trial verification code is: ${otp}. It expires in 10 minutes.`
    };

    await transporter.sendMail(mailOptions);
    console.log(`[OTP send] Successfully emailed OTP to ${normalized}`);

    return res.status(200).json({
      success: true,
      message: `Verification code successfully sent to ${normalized}`
    });
  } catch (error) {
    console.error('[OTP send] Handler error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to send verification code. Please try again.'
    });
  }
}
