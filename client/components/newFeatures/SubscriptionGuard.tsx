import React, { useState, useEffect } from 'react';
import axios from '../../context/axiosConfig';
import SubscriptionScreen from './SubscriptionScreen';
import SplashScreen from '../SplashScreen';
import { isFeatureOn } from '../../constants/features';

const PaywallGuard = ({ children }: { children: React.ReactNode }) => {
    const [isChecking, setIsChecking] = useState(true);
    const [isSubscribed, setIsSubscribed] = useState(true);

    useEffect(() => {
        checkSubscriptionStatus();
    }, []);

    const checkSubscriptionStatus = async () => {
        setIsChecking(true);
        try {
            // The axios cache answers instantly when it has a recent status; the
            // server reports 'active' when subscriptions are disabled globally.
            const res = await axios.get('/subscription/status');
            setIsSubscribed(!(res.data?.success && res.data.status !== 'active'));
        } catch (error) {
            // Network/server failure is not proof of an inactive plan; only an
            // explicit inactive answer shows the paywall.
            console.log("Error checking subscription:", error);
            setIsSubscribed(true);
        } finally {
            setIsChecking(false);
        }
    };

    if (isChecking) {
        return <SplashScreen />;
    }

    if (!isSubscribed) {
        return (
            <SubscriptionScreen
                onSuccess={() => setIsSubscribed(true)}
            />
        );
    }

    return <>{children}</>;
};

// No in-app Pro purchase at launch: skip the status check and never show the paywall.
const SubscriptionGuard = ({ children }: { children: React.ReactNode }) =>
    isFeatureOn('fyncProPaid') ? <PaywallGuard>{children}</PaywallGuard> : <>{children}</>;

export default SubscriptionGuard;
