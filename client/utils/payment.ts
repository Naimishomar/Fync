import { RAZORPAY_KEY_ID } from 'constants/keys';

export const handlePayment = async (amount, user, navigation) => {
  try {
    const orderRes = await fetch('http://10.21.99.81:3000/payment/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    });

    const order = await orderRes.json();
    console.log('Order RAW:', order);

    navigation.navigate('RazorpayWebView', {
      order,
      user,
      keyId: RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.log('Payment Error:', err);
    alert('Unable to start payment');
  }
};
