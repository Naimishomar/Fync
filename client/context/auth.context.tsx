import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios, { clearApiCache, setAuthToken, setOnAuthLost } from "./axiosConfig";
import * as Device from "expo-device";
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync, savePushTokenToBackend } from "../utils/notificationHelper";
import { syncFcmToken } from "../services/NotificationService";
import { trackUser, untrackUser } from "../utils/socket";
import { clearSupabaseAuth } from "../utils/supabase";
import { prefetchFeed } from "../utils/feedPrefetch";
import { getCrashlytics, setUserId } from "@react-native-firebase/crashlytics";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: any) => {
  const [user, setUser] = useState<any>(null);

  // Ties crash reports to an account id (never name or email).
  useEffect(() => {
    try { setUserId(getCrashlytics(), user?._id ? String(user._id) : '').catch(() => {}); } catch { /* not fatal */ }
  }, [user?._id]);
  const [loading, setLoading] = useState(true);

  // Tokens rarely change, so only POST when they differ from what this user
  // last saved successfully; otherwise every app open wrote to the server.
  // Single key (not per-id) so clearSession can drop it without knowing the user.
  const registerToken = async (userId?: string) => {
    if (!userId) return;
    try {
      let sent: { u?: string; expo?: string; fcm?: string } = {};
      try { sent = JSON.parse((await AsyncStorage.getItem("pushTokenSent")) || "{}"); } catch {}
      if (sent.u !== userId) sent = { u: userId };

      const token = await registerForPushNotificationsAsync();
      if (token && token !== sent.expo && (await savePushTokenToBackend(token))) sent.expo = token;

      // Also register FCM token for WhatsApp-style chat push notifications
      const fcm = await syncFcmToken(sent.fcm);
      if (fcm) sent.fcm = fcm;
      await AsyncStorage.setItem("pushTokenSent", JSON.stringify(sent));
    } catch (e) {
      console.log("Error in push registration flow:", e);
    }
  };

  // Local half of logout. Also run by axiosConfig when the refresh token is
  // rejected, so the app drops back to login instead of failing every call.
  const clearSession = async () => {
    // recentSearches is per-account too: the next login on this phone must not see it.
    await AsyncStorage.multiRemove(["accessToken", "refreshToken", "cachedUser", "recentSearches", "pushTokenSent"]);
    // The request interceptor holds the token in memory now; clearing storage
    // alone would leave the logged-out session still sending it.
    setAuthToken(null);
    // Drop the authenticated socket too, otherwise the previous user stays in
    // their private rooms and keeps receiving messages after logout.
    untrackUser();
    // Drop the cached Supabase identity too, or the next account signed in on
    // this device would keep querying as the previous user.
    clearSupabaseAuth();
    // Cached API responses belong to this account.
    await clearApiCache();
    setUser(null);
  };

  const logout = async () => {
    try {
      await axios.get("/user/logout");
    } catch (e) {
      console.log("Logout backend error:", e);
    }
    await clearSession();
  };

  const getDeviceId = async () => {
    let deviceId = await AsyncStorage.getItem("deviceId");
    if (!deviceId) {
      deviceId = "device_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
      await AsyncStorage.setItem("deviceId", deviceId);
    }
    return deviceId;
  };

  const login = async (email: string, password: string) => {
    try {
      // Never let this account read the previous one's cached responses.
      await clearApiCache();
      const deviceId = await getDeviceId();
      const deviceModel = Device.modelName || "Unknown Device";
      const res = await axios.post("/user/login", { email, password, deviceId, deviceModel });

      const { token, refreshToken, user } = res.data;
      if (!token || !refreshToken) {
        throw new Error("Invalid auth response");
      }
      await AsyncStorage.multiSet([
        ["accessToken", token],
        ["refreshToken", refreshToken],
      ]);
      setAuthToken(token);
      setUser(user);
      AsyncStorage.setItem("cachedUser", JSON.stringify(user));
      registerToken(user?._id);
    } catch (err: any) {
      console.log("LOGIN ERROR:", err?.response?.data || err.message);
      throw err;
    }
  };

  useEffect(() => {
    setOnAuthLost(() => {
      clearSession();
    });
    return () => setOnAuthLost(null);
  }, []);

  // Restore session on app start
  useEffect(() => {
    const bootstrap = async () => {
      const [[, token], [, cachedUser]] = await AsyncStorage.multiGet([
        "accessToken",
        "cachedUser",
      ]);

      if (!token) {
        setLoading(false);
        return;
      }

      // Boot from the last known user so the app renders in a few ms, and start
      // pulling the feed while the profile check runs behind the UI.
      let booted = false;
      if (cachedUser) {
        try {
          setUser(JSON.parse(cachedUser));
          setLoading(false);
          booted = true;
          prefetchFeed();
        } catch (e) {
          await AsyncStorage.removeItem("cachedUser");
        }
      }

      try {
        const res = await axios.get("/user/profile");
        setUser(res.data.user);
        AsyncStorage.setItem("cachedUser", JSON.stringify(res.data.user));
        if (!booted) prefetchFeed();
        registerToken(res.data.user?._id);
      } catch (error: any) {
        // Only a rejected session logs out. Offline / server hiccup keeps the
        // cached session, otherwise a flaky network signs the user out.
        if (error?.response?.status === 401) await logout();
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  // Keep socket presence in sync with the authenticated user so status,
  // typing and push notifications remain reliable across reconnects.
  useEffect(() => {
    if (user?._id) {
      trackUser(user._id);
    }
  }, [user?._id]);

  // Memoised so every useAuth() consumer does not re-render whenever the
  // provider does. login/logout only touch setters and storage, so the
  // versions captured here never go stale.
  const value = useMemo(
    () => ({ user, setUser, login, logout, loading, isLoggedIn: !!user }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, loading],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
