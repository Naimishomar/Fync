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
        let baseUrl = creds.portalUrl;
        if (!baseUrl.startsWith('http')) baseUrl = 'http://' + baseUrl;

        // Extract origin — Cyberoam/Sophos portals post to /login.xml on the same host
        let origin = baseUrl;
        try { origin = new URL(baseUrl).origin; } catch { }

        // ── Cyberoam / Sophos (httpclient.html portals) ────────────
        // Confirmed working via live test: POST to /login.xml with these exact fields
        const cyberoamFields = new URLSearchParams();
        cyberoamFields.append('mode', '191');
        cyberoamFields.append('username', creds.username!);
        cyberoamFields.append('password', creds.password!);
        cyberoamFields.append('a', Date.now().toString());
        cyberoamFields.append('producttype', '0');

        const cyberoamUrl = `${origin}/login.xml`;
        const cyberoamRes = await axios.post(cyberoamUrl, cyberoamFields.toString(), {
            timeout: 10000,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        const body: string = typeof cyberoamRes.data === 'string'
            ? cyberoamRes.data
            : JSON.stringify(cyberoamRes.data);

        // Cyberoam returns XML: <status>LIVE</status> or <status>LOGIN</status>
        const isSuccess = body.includes('LIVE') || body.includes('LOGIN') || body.includes('success');

        if (isSuccess) {
            Toast.show({ type: 'success', text1: 'Smart WiFi ✅', text2: 'Logged in successfully!' });
            return true;
        }

        // ── Generic fallback for other portal types ─────────────────
        const params = new URLSearchParams();
        params.append('username', creds.username!);
        params.append('password', creds.password!);
        params.append('user', creds.username!);
        params.append('pass', creds.password!);
        params.append('email', creds.username!);
        params.append('login', 'Login');
        params.append('submit', 'Login');

        await axios.post(baseUrl, params.toString(), {
            timeout: 10000,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            maxRedirects: 5,
        });

        Toast.show({ type: 'success', text1: 'Smart WiFi', text2: 'Login attempted! 🚀' });
        return true;

    } catch (error: any) {
        console.error('Wifi login failed:', error.message);
        return false;
    }
};

export const logoutPreviousSession = async (portalUrl: string) => {
    try {
        let baseUrl = portalUrl;
        if (!baseUrl.startsWith('http')) baseUrl = 'http://' + baseUrl;

        let origin = baseUrl;
        try { origin = new URL(baseUrl).origin; } catch { }

        // ── Cyberoam / Sophos logout (uses logout.xml with mode=193) ─
        const cyberoamLogout = new URLSearchParams();
        cyberoamLogout.append('mode', '193');
        cyberoamLogout.append('a', Date.now().toString());
        try {
            await axios.post(`${origin}/logout.xml`, cyberoamLogout.toString(), {
                timeout: 5000,
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });
        } catch { /* ignore */ }

        // ── Generic fallback logout URLs ────────────────────────────
        const genericLogoutUrls = [
            `${origin}/logout`,
            `${origin}/logoff`,
            `${origin}?logout=1`,
            `${origin}?action=logout`,
        ];
        for (const url of genericLogoutUrls) {
            try { await axios.get(url, { timeout: 3000 }); } catch { /* ignore */ }
        }

        Toast.show({ type: 'info', text1: 'Smart WiFi', text2: 'Logged out from previous session 🏃' });
        return true;
    } catch {
        return false;
    }
};
