import React, { useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import {
    getWifiCredentials,
    getWifiSettings,
    saveWifiSettings,
    loginToWifiPortal,
    logoutPreviousSession
} from '../../utils/wifiManager';
import { useAuth } from '../../context/auth.context';

const WifiSessionMonitor = () => {
    const { isLoggedIn } = useAuth();
    const lastSsid = useRef<string | null>(null);

    useEffect(() => {
        if (!isLoggedIn) return;

        // Initialize state from storage
        const init = async () => {
            const settings = await getWifiSettings();
            if (settings.lastSsid) {
                lastSsid.current = settings.lastSsid;
            }
        };
        init();

        const unsubscribe = NetInfo.addEventListener(async (state) => {
            if (state.type !== 'wifi' || !state.isConnected) {
                return;
            }

            const currentSsid = state.details.ssid;
            const settings = await getWifiSettings();

            if (!settings.enabled) return;

            // Detect change in SSID (building network change)
            if (currentSsid && currentSsid !== lastSsid.current) {
                console.log(`[WiFi MONITOR] Detected network change: ${lastSsid.current} -> ${currentSsid}`);

                const creds = await getWifiCredentials();

                if (creds && creds.portalUrl && creds.username && creds.password) {
                    // 1. Logout from previous session
                    await logoutPreviousSession(creds.portalUrl);

                    // 2. Login to new session
                    await loginToWifiPortal(creds);

                    // 3. Update last SSID
                    lastSsid.current = currentSsid;
                    await saveWifiSettings({
                        ...settings,
                        lastSsid: currentSsid,
                        lastCheckTime: Date.now()
                    });
                }
            } else if (!lastSsid.current && currentSsid) {
                // First time detection
                lastSsid.current = currentSsid;
                await saveWifiSettings({
                    ...settings,
                    lastSsid: currentSsid,
                    lastCheckTime: Date.now()
                });
            }
        });

        return () => unsubscribe();
    }, [isLoggedIn]);

    return null; // Silent background component
};

export default WifiSessionMonitor;
