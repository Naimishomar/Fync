// Expo inlines only EXPO_PUBLIC_* variables into the bundle, so these are the
// names that actually resolve at runtime. Anything without the prefix is
// undefined in a build, however it is declared here.
declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_BACKEND_URL: string;
    EXPO_PUBLIC_RAZORPAY_KEY_ID: string;
    EXPO_PUBLIC_DRIVE_API_KEY: string;
    EXPO_PUBLIC_SUPABASE_URL: string;
    EXPO_PUBLIC_SUPABASE_KEY: string;
  }
}
