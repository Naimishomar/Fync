import { RAZORPAY_KEY_ID } from 'constants/keys';
import axios from '../context/axiosConfig';

export const handlePayment = async (amount: number, user: any, navigation: any) => {
  try {
    const orderRes = await axios.post('/payment/api/order', {
      amount,
    });
    const order = orderRes.data;
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
