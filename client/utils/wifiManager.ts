import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Toast from 'react-native-toast-message';

const WIFI_CREDENTIALS_KEY = "wifi_credentials";
const WIFI_SETTINGS_KEY = "wifi_settings";

export interface WifiCredentials {
    portalUrl: string;
    username: string;
    password?: string;
}

export interface WifiSettings {
    enabled: boolean;
    lastSsid?: string;
    lastCheckTime?: number;
}

export const saveWifiCredentials = async (creds: WifiCredentials) => {
    try {
        await AsyncStorage.setItem(WIFI_CREDENTIALS_KEY, JSON.stringify(creds));
    } catch (error) {
        console.error("Error saving wifi credentials:", error);
        throw error;
    }
};

export const getWifiCredentials = async (): Promise<WifiCredentials | null> => {
    try {
        const creds = await AsyncStorage.getItem(WIFI_CREDENTIALS_KEY);
        return creds ? JSON.parse(creds) : null;
    } catch (error) {
        console.error("Error getting wifi credentials:", error);
        return null;
    }
};

export const deleteWifiCredentials = async () => {
    try {
        await AsyncStorage.removeItem(WIFI_CREDENTIALS_KEY);
    } catch (error) {
        console.error("Error deleting wifi credentials:", error);
    }
};

export const saveWifiSettings = async (settings: WifiSettings) => {
    try {
        await AsyncStorage.setItem(WIFI_SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
        console.error("Error saving wifi settings:", error);
    }
};

export const getWifiSettings = async (): Promise<WifiSettings> => {
    try {
        const settings = await AsyncStorage.getItem(WIFI_SETTINGS_KEY);
        return settings ? JSON.parse(settings) : { enabled: false };
    } catch (error) {
        return { enabled: false };
    }
};

export const loginToWifiPortal = async (creds: WifiCredentials) => {
    try {
        let url = creds.portalUrl;
        if (!url.startsWith('http')) url = 'http://' + url;

        const response = await axios.post(url, {
            username: creds.username,
            password: creds.password,
            user: creds.username,
            pass: creds.password,
            email: creds.username,
            login: 'Login'
        }, { timeout: 10000 });

        Toast.show({
            type: 'success',
            text1: 'Smart WiFi',
            text2: 'Login successful! 🚀'
        });

        return true;
    } catch (error: any) {
        console.error("Wifi login failed:", error.message);
        return false;
    }
};

export const logoutPreviousSession = async (portalUrl: string) => {
    try {
        let url = portalUrl;
        if (!url.startsWith('http')) url = 'http://' + url;

        const logoutUrls = [
            `${url}/logout`,
            `${url}?logout=1`,
            url
        ];

        for (const logoutUrl of logoutUrls) {
            try {
                await axios.get(logoutUrl, { timeout: 5000 });
            } catch (e) {
                // Ignore errors during logout
            }
        }

        Toast.show({
            type: 'info',
            text1: 'Smart WiFi',
            text2: 'Logged out from previous session 🏃‍♂️'
        });

        return true;
    } catch (error) {
        return false;
    }
};
