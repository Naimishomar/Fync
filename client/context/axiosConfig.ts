import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const API_URL = BACKEND_URL;
axios.defaults.baseURL = API_URL;

// Simple cache object
const cache: { [key: string]: { data: any; expiry: number } } = {};
const CACHE_DURATION = 30000; // 30 seconds default


axios.interceptors.request.use(
  async config => {
    // Check if we can serve from cache
    if (config.method === 'get' && !config.params?.noCache) {
      const cacheKey = `${config.url}${JSON.stringify(config.params || {})}`;
      const cached = cache[cacheKey];
      if (cached && Date.now() < cached.expiry) {
        config.adapter = async () => {
          return {
            data: cached.data,
            status: 200,
            statusText: 'OK',
            headers: config.headers,
            config: config,
            request: {}
          };
        };
      }
    }

    const token = await AsyncStorage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

axios.interceptors.response.use(
  response => {
    // Save to cache if it's a GET request
    if (response.config.method === 'get') {
      const cacheKey = `${response.config.url}${JSON.stringify(response.config.params || {})}`;
      cache[cacheKey] = {
        data: response.data,
        expiry: Date.now() + CACHE_DURATION
      };
    }
    return response;
  },
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
