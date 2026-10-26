import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.OTP_PORT || 5199;

app.use(cors());
app.use(express.json());

// Persistent storage for used trial emails to prevent abuse
const DATA_DIR = path.join(__dirname, 'data');
const USED_EMAILS_FILE = path.join(DATA_DIR, 'used_trial_emails.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadUsedEmails() {
  try {
    if (fs.existsSync(USED_EMAILS_FILE)) {
      const content = fs.readFileSync(USED_EMAILS_FILE, 'utf-8');
      return JSON.parse(content || '{}');
    }
  } catch (err) {
    console.error('[OTP Server] Error reading used_trial_emails.json:', err);
  }
  return {};
}

function saveUsedEmails(data) {
  try {
    fs.writeFileSync(USED_EMAILS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[OTP Server] Error saving used_trial_emails.json:', err);
  }
}

// Memory store for active OTP codes: normalizedEmail -> { otp, expiresAt, attempts, uid }
const otpStore = new Map();

/**
 * Configure Nodemailer SMTP Transporter
 */
function createTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (user && pass) {
    if (user.endsWith('@gmail.com') || process.env.SMTP_HOST === 'smtp.gmail.com') {
      return nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass }
      });
    }

    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  return null;
}

// Health check endpoint
app.get('/api/otp/health', (req, res) => {
  res.json({
    success: true,
    status: 'Email OTP verification backend operational',
    smtpConfigured: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
    timestamp: Date.now()
  });
});

// Admin audit endpoint
app.get('/api/otp/claimed-emails', (req, res) => {
  const used = loadUsedEmails();
  res.json({
    success: true,
    totalClaimed: Object.keys(used).length,
    claimed: used
  });
});

/**
 * Send OTP endpoint for Email
 */
app.post('/api/otp/send', async (req, res) => {
  try {
    const rawEmail = req.body.email || req.body.phone; // support email or phone property
    const uid = req.body.uid;

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
        error: 'Disposable burner emails are not allowed for free trials. Please provide an authentic personal or business email.'
      });
    }

    // Anti-Abuse Check: Has this email already claimed a trial?
    const usedEmails = loadUsedEmails();
    if (usedEmails[normalized]) {
      const claimInfo = usedEmails[normalized];
      const claimDate = claimInfo.claimedAt
        ? new Date(claimInfo.claimedAt).toLocaleDateString('en-GB')
        : 'previously';

      return res.status(400).json({
        success: false,
        error: `This email address (${normalized}) has already claimed a 3-Day Free Trial on ${claimDate}. Each account is eligible for 1 free trial to prevent abuse. Please select a Basic or Pro plan to continue.`
      });
    }

    // Rate limiting: wait at least 30 seconds before sending another code to the same email
    const existing = otpStore.get(normalized);
    if (existing && (Date.now() - existing.lastSentAt) < 30000) {
      const secondsLeft = Math.ceil((30000 - (Date.now() - existing.lastSentAt)) / 1000);
      return res.status(429).json({
        success: false,
        error: `Please wait ${secondsLeft} seconds before requesting another code.`
      });
    }

    // Generate 6-digit OTP code
    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes expiry

    otpStore.set(normalized, {
      otp: otpCode,
      expiresAt,
      attempts: 0,
      uid: uid || null,
      lastSentAt: Date.now()
    });

    console.log(`\n=========================================`);
    console.log(`[TRIAL EMAIL OTP GENERATED]`);
    console.log(`Email: ${normalized}`);
    console.log(`Code:  >>> ${otpCode} <<<`);
    console.log(`Valid for 10 minutes`);
    console.log(`=========================================\n`);

    // Send real email via Nodemailer
    const transporter = createTransporter();
    let emailSent = false;
    let emailError = null;

    if (transporter) {
      try {
        const fromAddress = process.env.SMTP_FROM || `"LAMBA Business" <${process.env.SMTP_USER}>`;
        
        await transporter.sendMail({
          from: fromAddress,
          to: normalized,
          subject: `${otpCode} is your LAMBA 3-Day Trial Verification Code`,
          text: `Your LAMBA verification code for the 3-Day Free Trial is ${otpCode}. It is valid for 10 minutes. Do not share this code with anyone.`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
                .card { max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
                .badge { display: inline-block; background: #dbeafe; color: #1e40af; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; margin-bottom: 12px; }
                .title { font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 10px 0; }
                .desc { font-size: 14px; color: #64748b; line-height: 1.6; margin-bottom: 24px; }
                .code-box { background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 18px; text-align: center; margin-bottom: 24px; }
                .code { font-size: 36px; font-weight: 900; letter-spacing: 6px; color: #2563eb; font-family: monospace; }
                .meta { font-size: 12px; color: #94a3b8; line-height: 1.5; border-top: 1px solid #f1f5f9; padding-top: 16px; }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="badge">LAMBA • 3-Day Free Trial</div>
                <h1 class="title">Verify Your Email Address</h1>
                <p class="desc">Thank you for starting your 3-Day Free Trial! Use the verification code below to activate your company workspace immediately.</p>
                <div class="code-box">
                  <div class="code">${otpCode}</div>
                </div>
                <p class="desc" style="margin-bottom: 16px; font-size: 13px;">
                  ⏱️ This code will expire in <strong>10 minutes</strong>. If you did not request this verification, you can safely ignore this email.
                </p>
                <div class="meta">
                  Secure verification by LAMBA Business Management.<br>
                  Do not share this code with anyone.
                </div>
              </div>
            </body>
            </html>
          `
        });

        emailSent = true;
        console.log(`[OTP Server] Real Email OTP successfully delivered to ${normalized}`);
      } catch (sendErr) {
        emailError = sendErr.message;
        console.error('[OTP Server] Error sending email via SMTP:', sendErr);
      }
    } else {
      console.warn(`[OTP Server] SMTP not configured in .env. Code ${otpCode} printed to console for ${normalized}.`);
    }

    return res.json({
      success: true,
      message: `Verification code sent to ${normalized}`,
      email: normalized,
      expiresIn: 600,
      emailSent,
      ...(emailError ? { emailWarning: 'SMTP dispatch note: ' + emailError } : {})
    });
  } catch (err) {
    console.error('[OTP Server] /api/otp/send error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error while sending verification code' });
  }
});

/**
 * Verify OTP endpoint for Email
 */
app.post('/api/otp/verify', (req, res) => {
  try {
    const rawEmail = req.body.email || req.body.phone;
    const otp = req.body.otp;
    const uid = req.body.uid;

    if (!rawEmail || !otp) {
      return res.status(400).json({ success: false, error: 'Both email and verification code are required' });
    }

    const normalized = String(rawEmail).trim().toLowerCase();
    const entry = otpStore.get(normalized);

    if (!entry) {
      return res.status(400).json({
        success: false,
        error: 'No active verification code found for this email. Please request a new code.'
      });
    }

    if (Date.now() > entry.expiresAt) {
      otpStore.delete(normalized);
      return res.status(400).json({
        success: false,
        error: 'Verification code has expired. Please request a new one.'
      });
    }

    if (entry.attempts >= 5) {
      otpStore.delete(normalized);
      return res.status(400).json({
        success: false,
        error: 'Too many incorrect attempts. Please request a new code.'
      });
    }

    const cleanInputOtp = String(otp).trim();
    if (cleanInputOtp !== entry.otp) {
      entry.attempts += 1;
      const remainingAttempts = 5 - entry.attempts;
      return res.status(400).json({
        success: false,
        error: `Incorrect verification code. ${remainingAttempts} attempt(s) remaining.`
      });
    }

    // OTP is valid!
    otpStore.delete(normalized);

    // Save into used trial emails database to permanently prevent abuse
    const usedEmails = loadUsedEmails();
    usedEmails[normalized] = {
      email: normalized,
      uid: uid || entry.uid || null,
      claimedAt: Date.now(),
      status: 'verified'
    };
    saveUsedEmails(usedEmails);

    console.log(`[TRIAL EMAIL OTP VERIFIED] Successfully verified: ${normalized} for UID: ${uid || entry.uid || 'N/A'}`);

    return res.json({
      success: true,
      verified: true,
      email: normalized,
      message: 'Email address verified successfully! 3-Day Free Trial unlocked.'
    });
  } catch (err) {
    console.error('[OTP Server] /api/otp/verify error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error while verifying OTP' });
  }
});

app.listen(PORT, () => {
  console.log(`[OTP Server] Email OTP Verification Backend listening on http://localhost:${PORT}`);
});
