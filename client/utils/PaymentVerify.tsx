import React, { useEffect } from "react";
import { View, Text } from "react-native";

export default function PaymentVerify({ route, navigation }) {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    order,
    user
  } = route.params;

  useEffect(() => {
    const verify = async () => {
      const res = await fetch("http://192.168.28.228:3000/payment/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature,
          customerName: user.name,
          customerEmail: user.email,
          amount: order.amount / 100
        })
      });

      const json = await res.json();

      if (json.success) {
        alert("Payment Successful 🎉");
        console.log("Receipt:", json.receipt_url);
      } else {
        alert("Verification Failed ❌");
      }

      navigation.goBack();
    };

    verify();
  }, []);

  return (
    <View>
      <Text>Verifying Payment...</Text>
    </View>
  );
}
