import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";

export default function RazorpayWebView({ route, navigation }) {
  const { order, user, keyId } = route.params;
  const [html, setHtml] = useState("");

  useEffect(() => {
    const content = `
      <html>
      <body>
        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
        <script>
          var options = {
            key: "${keyId}",
            amount: "${order.amount}",
            currency: "INR",
            name: "Fync",
            description: "Fync Ordering System",
            order_id: "${order.id}",
            prefill: {
              name: "${user.name}",
              email: "${user.email}",
              contact: "${user.mobileNumber}"
            },
            handler: function (response) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                event: "SUCCESS",
                data: response
              }));
            },
            modal: {
              ondismiss: function () {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  event: "FAILED"
                }));
              }
            }
          };
          var rzp1 = new Razorpay(options);
          rzp1.open();
        </script>
      </body>
      </html>
    `;
    setHtml(content);
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {html ? (
        <WebView
          source={{ html }}
          originWhitelist={["*"]}
          onMessage={(event) => {
            const msg = JSON.parse(event.nativeEvent.data);

            if (msg.event === "SUCCESS") {
              navigation.replace("PaymentVerify", {
                ...msg.data,
                order,
                user,
              });
            } else {
              alert("Payment Cancelled ❌");
              navigation.goBack();
            }
          }}
        />
      ) : (
        <ActivityIndicator size="large" />
      )}
    </View>
  );
}
