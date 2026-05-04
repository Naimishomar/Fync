import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import axios from '../../context/axiosConfig';
import SubscriptionScreen from './SubscriptionScreen';

const SubscriptionGuard = ({ children }: { children: React.ReactNode }) => {
    const [isChecking, setIsChecking] = useState(true);
    const [isSubscribed, setIsSubscribed] = useState(false);

    useEffect(() => {
        checkSubscriptionStatus();
    }, []);

    const checkSubscriptionStatus = async () => {
        setIsChecking(true);
        try {
            const res = await axios.get(`/subscription/status?t=${new Date().getTime()}`);
            if (res.data.success && res.data.status === 'active') {
                setIsSubscribed(true);
            } else {
                setIsSubscribed(false);
            }
        } catch (error) {
            console.error("Error checking subscription:", error);
            // Default to not subscribed on error to be safe, or could allow retry
            setIsSubscribed(false);
        } finally {
            setIsChecking(false);
        }
    };

    if (isChecking) {
        return (
            <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#ec4899" />
            </View>
        );
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

export default SubscriptionGuard;
