import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import axios from '../context/axiosConfig';

interface PaymentVerifyProps {
  route: {
    params: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
      order: any;
      user: any;
    };
  };
}

export default function PaymentVerify({ route }: PaymentVerifyProps) {
  const navigation: any = useNavigation();
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order, user } = route.params;

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState<boolean | null>(null);
  const [receiptUrl, setReceiptUrl] = useState('');

const verifyPayment = async () => {
    try {
      const res = await axios.post('/payment/api/verify', {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        customerName: user.name,
        customerEmail: user.email,
        amount: order.amount / 100,
      },
      {
          headers: { 
            'Content-Type': 'application/json' 
          }
        });

      if (res.data.success) {
        setSuccess(true);
        setReceiptUrl(res.data.receipt_url || '');
        console.log(res.data.receipt_url || '');
      } else {
        setSuccess(false);
      }
    } catch (err) {
      console.log("Failed to verify", err);
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    verifyPayment();
  }, []);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator size="large" color="white" />
        <Text className="mt-3 text-xl text-white">Verifying Payment...</Text>
      </View>
    );
  }

  // ⬇ SUCCESS UI
  if (success) {
    return (
      <View className="flex-1 items-center justify-center bg-black px-5">
        <Text className="mb-3 text-3xl font-bold text-green-400">Payment Successful 🎉</Text>

        <Text className="mb-10 text-lg text-gray-300">Thank you for your payment!</Text>

        {/* DOWNLOAD RECEIPT */}
        {receiptUrl ? (
          <Pressable
            className="mb-5 rounded-xl bg-pink-400 px-6 py-3"
            onPress={() => navigation.navigate('ReceiptWebview', { url: receiptUrl })}>
            <Text className="text-lg font-semibold text-white">Download Receipt</Text>
          </Pressable>
        ) : null}

        {/* GO HOME */}
        <Pressable
          className="rounded-xl border border-gray-400 px-6 py-3"
          onPress={() =>
            navigation.reset({
              index: 0,
              routes: [{ name: 'Home1' }],
            })
          }>
          <Text className="text-lg font-semibold text-white">Go Back to Home</Text>
        </Pressable>
      </View>
    );
  }

  // ⬇ FAILURE UI
  return (
    <View className="flex-1 items-center justify-center bg-black px-5">
      <Text className="mb-3 text-3xl font-bold text-red-400">Payment Failed ❌</Text>

      <Text className="mb-10 text-center text-lg text-gray-300">
        Something went wrong. Your payment was not completed.
      </Text>

      <Pressable
        className="mb-5 rounded-xl bg-red-500 px-6 py-3"
        onPress={() =>
          navigation.reset({
            index: 0,
            routes: [{ name: 'Home1' }],
          })
        }>
        <Text className="text-lg font-semibold text-white">Go Back to Home</Text>
      </Pressable>
    </View>
  );
}
