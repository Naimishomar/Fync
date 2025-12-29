import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';

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

  // ⬇ VERIFY PAYMENT FROM BACKEND
  const verifyPayment = async () => {
    try {
      const res = await fetch('http://192.168.28.79:3000/payment/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature,
          customerName: user.name,
          customerEmail: user.email,
          amount: order.amount / 100,
        }),
      });

      const json = await res.json();

      if (json.success) {
        setSuccess(true);
        setReceiptUrl(json.receipt_url || ''); // backend should return this
        console.log(json.receipt_url || '');
      } else {
        setSuccess(false);
      }
    } catch (err) {
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    verifyPayment();
  }, []);

  // ⬇ LOADING UI
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
          <TouchableOpacity
            className="mb-5 rounded-xl bg-pink-400 px-6 py-3"
            onPress={() => navigation.navigate('ReceiptWebview', { url: receiptUrl })}>
            <Text className="text-lg font-semibold text-white">Download Receipt</Text>
          </TouchableOpacity>
        ) : null}

        {/* GO HOME */}
        <TouchableOpacity
          className="rounded-xl border border-gray-400 px-6 py-3"
          onPress={() =>
            navigation.reset({
              index: 0,
              routes: [{ name: 'Home1' }],
            })
          }>
          <Text className="text-lg font-semibold text-white">Go Back to Home</Text>
        </TouchableOpacity>
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

      <TouchableOpacity
        className="mb-5 rounded-xl bg-red-500 px-6 py-3"
        onPress={() =>
          navigation.reset({
            index: 0,
            routes: [{ name: 'Home1' }],
          })
        }>
        <Text className="text-lg font-semibold text-white">Go Back to Home</Text>
      </TouchableOpacity>
    </View>
  );
}
