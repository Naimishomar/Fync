// Fail at boot rather than at checkout.
//
// The backend was running Razorpay TEST keys — duplicated twice in .env, where
// dotenv silently keeps the first occurrence — so no real payment could ever be
// captured and nothing anywhere said so. These checks make that class of
// misconfiguration impossible to deploy quietly.

const REQUIRED = [
  'MONGO_URI',
  'REDIS_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  // utils/r2.js calls process.exit(1) at import time when these are absent,
  // which reports one missing variable at a time with no context. Listing them
  // here surfaces everything that is missing in a single message instead.
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
];

export const validateConfig = () => {
  const isProd = process.env.NODE_ENV === 'production';
  const missing = REQUIRED.filter((k) => !process.env[k]);
  const warnings = [];

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const isLiveKey = keyId.startsWith('rzp_live_');
  const isTestKey = keyId.startsWith('rzp_test_');

  if (!isLiveKey && !isTestKey) {
    throw new Error('RAZORPAY_KEY_ID is malformed — expected rzp_live_… or rzp_test_…');
  }
  if (isProd && isTestKey) {
    throw new Error(
      'Refusing to start: NODE_ENV=production with a Razorpay TEST key. ' +
        'No payment would be captured. Set live keys or unset NODE_ENV=production.'
    );
  }
  if (!isProd && isLiveKey) {
    warnings.push('Razorpay LIVE keys are active outside production — real money will move.');
  }

  // A short or default JWT secret is trivially brute-forced, and every session
  // in the app hangs off it.
  if (process.env.JWT_SECRET.length < 32) {
    warnings.push('JWT_SECRET is shorter than 32 characters. Use a long random value.');
  }
  if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
    warnings.push('JWT_SECRET and JWT_REFRESH_SECRET are identical — an access token would pass as a refresh token.');
  }
  if (isProd && !process.env.CORS_ORIGIN) {
    warnings.push('CORS_ORIGIN is unset in production, so the API accepts any origin.');
  }

  warnings.forEach((w) => console.warn(`⚠️  Config: ${w}`));
  console.log(`✅ Config valid — Razorpay in ${isLiveKey ? 'LIVE' : 'TEST'} mode`);
};

export default validateConfig;
