function sanitizeEmail(email) {
  return String(email || '').trim().toLowerCase().replace(/[\.\#\$\[\]]/g, '_');
}

export default async function handler(req, res) {
  // Enable CORS
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
    const rawOtp = req.body?.otp;
    const uid = req.body?.uid;

    if (!rawEmail || !rawOtp) {
      return res.status(400).json({ success: false, error: 'Email and verification code are required' });
    }

    const normalized = String(rawEmail).trim().toLowerCase();
    const cleanOtp = String(rawOtp).trim();
    const sanitized = sanitizeEmail(normalized);

    // Fetch active OTP record from Firebase RTDB
    const otpResp = await fetch(`https://panel-adefe-default-rtdb.firebaseio.com/system_trial_otps/${sanitized}.json`);
    const record = await otpResp.json();

    if (!record || !record.otp) {
      return res.status(400).json({
        success: false,
        error: 'No active verification code found for this email. Please click Resend Code.'
      });
    }

    // Check expiration
    if (Date.now() > Number(record.expiresAt || 0)) {
      // Clean up expired record
      await fetch(`https://panel-adefe-default-rtdb.firebaseio.com/system_trial_otps/${sanitized}.json`, { method: 'DELETE' });
      return res.status(400).json({
        success: false,
        error: 'Verification code has expired. Please request a new code.'
      });
    }

    // Check OTP match
    if (String(record.otp).trim() !== cleanOtp) {
      return res.status(400).json({
        success: false,
        error: 'Incorrect verification code. Please check your inbox and try again.'
      });
    }

    // OTP is valid!
    // 1. Mark email as claimed in Firebase RTDB
    const claimedRecord = {
      email: normalized,
      uid: uid || record.uid || null,
      claimedAt: Date.now()
    };
    await fetch(`https://panel-adefe-default-rtdb.firebaseio.com/system_claimed_trial_emails/${sanitized}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(claimedRecord)
    });

    // 2. Delete used OTP
    await fetch(`https://panel-adefe-default-rtdb.firebaseio.com/system_trial_otps/${sanitized}.json`, { method: 'DELETE' });

    console.log(`[OTP verify] Successfully verified email ${normalized}`);

    return res.status(200).json({
      success: true,
      message: 'Email successfully verified!',
      email: normalized
    });
  } catch (error) {
    console.error('[OTP verify] Handler error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Verification failed. Please try again.'
    });
  }
}
