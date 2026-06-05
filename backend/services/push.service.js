import admin from 'firebase-admin';

// NOTE: To initialize this, we need the service account credentials.
// For now, we will lazily initialize or try to initialize if FIREBASE_SERVICE_ACCOUNT is present.

let isInitialized = false;

try {
  // If the user provides a service account JSON string in env
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    isInitialized = true;
    console.log("Firebase Admin initialized successfully.");
  } else {
    console.log("Firebase Admin not initialized. Missing FIREBASE_SERVICE_ACCOUNT env var.");
  }
} catch (error) {
  console.error("Failed to initialize Firebase Admin:", error);
}

/**
 * Sends a push notification to an array of FCM tokens.
 * @param {string[]} tokens - Array of FCM device tokens
 * @param {object} payload - Notification payload (title, body, data)
 */
export const sendPushNotification = async (tokens, payload) => {
  if (!isInitialized) {
    console.log("Push notifications skipped (Firebase Admin not initialized).");
    return false;
  }

  if (!tokens || tokens.length === 0) return false;

  const message = {
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data || {},
    tokens: tokens, // Multicast messaging
  };

  try {
    const response = await admin.messaging().sendMulticast(message);
    console.log(`Successfully sent message to ${response.successCount} devices`);
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
        }
      });
      console.log('Failed tokens:', failedTokens);
      // Optional: Remove failed tokens from database if they are invalid (NotRegistered error)
    }
    return true;
  } catch (error) {
    console.error("Error sending push notification:", error);
    return false;
  }
};
