import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "./axiosConfig";
import * as Device from "expo-device";
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync, savePushTokenToBackend } from "../utils/notificationHelper";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: any) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const registerToken = async () => {
    try {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        await savePushTokenToBackend(token);
      }
    } catch (e) {
      console.log("Error in push registration flow:", e);
    }
  };

  const logout = async () => {
    try {
      await axios.get("/user/logout");
    } catch (e) {
      console.log("Logout backend error:", e);
    }
    await AsyncStorage.multiRemove(["accessToken", "refreshToken"]);
    setUser(null);
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
      setUser(user);
      registerToken();
    } catch (err: any) {
      console.log("LOGIN ERROR:", err?.response?.data || err.message);
      throw err;
    }
  };

  // Restore session on app start
  useEffect(() => {
    const bootstrap = async () => {
      try {
        const token = await AsyncStorage.getItem("accessToken");

        if (!token) {
          setLoading(false);
          return;
        }

        // This request will AUTO refresh token if expired
        const res = await axios.get("/user/profile");
        setUser(res.data.user);
        registerToken();
      } catch (error) {
        console.log(error);
        await logout();
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        loading,
        isLoggedIn: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
