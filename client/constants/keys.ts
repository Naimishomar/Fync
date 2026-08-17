// This was hardcoded to a Razorpay *test* key ("rzp_test_..."), so release
// builds could not take a real payment — checkout would open in test mode and
// no money would move.
//
// Razorpay's key_id is a publishable identifier and is safe to ship in the app;
// only the key_secret must stay on the server. It still comes from the
// environment so test and live builds don't need a code change.
export const RAZORPAY_KEY_ID = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ?? '';

if (!RAZORPAY_KEY_ID) {
  console.warn(
    '[payments] EXPO_PUBLIC_RAZORPAY_KEY_ID is not set — checkout will fail. ' +
      'Set it in .env for local builds and in EAS secrets for release builds.'
  );
} else if (__DEV__ === false && RAZORPAY_KEY_ID.startsWith('rzp_test_')) {
  console.warn('[payments] Release build is using a Razorpay TEST key. No real payment will be captured.');
}
