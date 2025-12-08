import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

const API_URL = "http://192.168.28.228:3000";

type UserType = {
  id?: string;
  name?: string;
  email?: string;
  username?: string;
  mobileNumber?: string;
  dob?: string;
  college?: string;
  year?: string;
  gender?: string;
  major?: string;
  avatar?: string;
  banner?: string;
  followers?: string[];
  following?: string[];
  is_subscribed?: boolean;
  about?: string;
  skills?: string[];
  experience?: string;
  interest?: string[];
  hobbies?: string[];
  github_id?: string;
  linkedIn_id?: string;
  token?: string;
};

type AuthContextType = {
  user: UserType | null;
  isLoggedIn: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoggedIn: false,
  loading: true,
  login: async () => {},
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserFromStorage = async () => {
      setLoading(true);
      const token = await AsyncStorage.getItem("token");
      console.log(token);
    
      if (token) {
        try {
          axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
          const res = await axios.get(`${API_URL}/user/profile`);
          if (res.data.success) {
            setUser({ ...res.data.user, token });
          }
        } catch (error) {
          console.log("Auth load failed", error);
          await AsyncStorage.removeItem("token");
        }
      }
      setLoading(false);
    };

    loadUserFromStorage();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await axios.post(`${API_URL}/user/login`, { email, password });
      if (res.data.success) {
        const token = res.data.token;
        await AsyncStorage.setItem("token", token);
        axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        setUser({ ...res.data.user, token });
      }
    } catch (error) {
      console.log("Login failed:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await axios.get(`${API_URL}/user/logout`);
    } catch {}

    await AsyncStorage.removeItem("token");
    setUser(null);
    delete axios.defaults.headers.common["Authorization"];
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
