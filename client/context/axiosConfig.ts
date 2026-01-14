import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = "http://192.168.28.195:3000";

axios.defaults.baseURL = API_URL;

// Attach access token on every request (if exists)
axios.interceptors.request.use(
  async config => {
    const token = await AsyncStorage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

// Handle token refresh automatically
axios.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    const isAuthRoute =
      originalRequest?.url?.includes("/user/login") ||
      originalRequest?.url?.includes("/user/refresh-token");

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthRoute
    ) {
      originalRequest._retry = true;

      try {
        const refreshToken = await AsyncStorage.getItem("refreshToken");
        if (!refreshToken) {
          return Promise.reject(error);
        }

        const res = await axios.post("/user/refresh-token", {
          refreshToken,
        });

        const newAccessToken = res.data.token;

        await AsyncStorage.setItem("accessToken", newAccessToken);

        axios.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        return axios(originalRequest);
      } catch (refreshError) {
        await AsyncStorage.multiRemove(["accessToken", "refreshToken"]);
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axios;
