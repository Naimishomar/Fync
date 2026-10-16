import React, { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppBar } from "../components/ui/kit";

interface RazorpayWebViewProps {
  route: {
    params: {
      order: any;
      user: any;
      keyId: string;
      merchantName?: string;
      merchantUpiId?: string;
    };
  };
  navigation: any;
}

export default function RazorpayWebView({ route, navigation }: RazorpayWebViewProps) {
  const { order, user, keyId, merchantName, merchantUpiId } = route.params;
  const [html, setHtml] = useState("");

  useEffect(() => {
    // JSON.stringify, not "${...}": a quote in a name ended the string literal
    // and the checkout never opened. A missing phone also prefilled "undefined".
    const js = (v: unknown) => JSON.stringify(v ?? "");
    const content = `
      <html>
      <body>
        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
        <script>
          var options = {
            key: ${js(keyId)},
            amount: ${js(String(order?.amount ?? ""))},
            currency: "INR",
            name: ${js(merchantName || "Fync")},
            description: "Tip to Creator",
            order_id: ${js(order?.id)},
            prefill: {
              name: ${js(user?.name)},
              email: ${js(user?.email)},
              contact: ${js(user?.mobileNumber)}
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
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <AppBar title="Payment" onBack={() => navigation.goBack()} />
      {html ? (
        <WebView
          source={{ html }}
          originWhitelist={["*"]}
          onMessage={(event) => {
            let msg: any;
            try { msg = JSON.parse(event.nativeEvent.data); } catch { return; }

            if (msg.event === "SUCCESS") {
              navigation.replace("PaymentVerify", {
                ...msg.data,
                order,
                user,
                merchantName,
                merchantUpiId
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
    </SafeAreaView>
  );
}
