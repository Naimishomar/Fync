import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
console.log("🌐 Axios Base URL:", BACKEND_URL);
axios.defaults.baseURL = BACKEND_URL;

axios.interceptors.request.use(
  async config => {
    const token = await AsyncStorage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Check if we have cached data for this GET request
    if (config.method === 'get' && !config.params?.noCache) {
      const cacheKey = `cache_${config.url}`;
      const cachedData = await AsyncStorage.getItem(cacheKey);
      if (cachedData) {
        config.headers['x-cache-hit'] = 'true';
      }
    }
    
    return config;
  },
  error => Promise.reject(error)
);

axios.interceptors.response.use(
  async response => {
    // Cache successful GET requests
    if (response.config.method === 'get' && response.status === 200 && !response.config.params?.noCache) {
      const cacheKey = `cache_${response.config.url}`;
      await AsyncStorage.setItem(cacheKey, JSON.stringify(response.data));
    }
    return response;
  },
  async (error: any) => {
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

    console.log("❌ Axios Error:", error.message, error.config?.url);
    if (error.response) {
      console.log("❌ Error Data:", error.response.data);
    }
    return Promise.reject(error);
  }
);

// Function to limit cache size and prevent storage bloat
const limitCache = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(k => k.startsWith('cache_'));
    if (cacheKeys.length > 50) {
      // Remove oldest keys (simplistic approach)
      const toRemove = cacheKeys.slice(0, cacheKeys.length - 50);
      await AsyncStorage.multiRemove(toRemove);
    }
  } catch (e) {
    console.log("Cache limit error", e);
  }
};

// Periodically clean up cache
setTimeout(limitCache, 5000);

export default axios;
