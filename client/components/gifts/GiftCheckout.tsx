import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, TextInput, Switch, KeyboardAvoidingView, Platform, type TextInputProps } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { C } from '../../constants/colors';
import { RAZORPAY_KEY_ID } from '../../constants/keys';
import { AppBar, Screen, Button, BottomBar, Label } from '../ui/kit';
import { GiftProduct, rupees, priceWith, deliveryBy } from './shared';

type Params = { product: GiftProduct; customization: { photos: string[]; text: string; options: Record<string, string> } };

const Field = ({ label, ...p }: TextInputProps & { label: string }) => (
  <View className="mt-4">
    <Label>{label}</Label>
    <TextInput placeholderTextColor={C.ink3} {...p}
      className="mt-2 rounded-card border border-line bg-card px-4 py-3 text-ink" style={{ fontSize: 15, minHeight: 48 }} />
  </View>
);

/** Recipient + address, then pay through the shared Razorpay flow (RazorpayWebView → PaymentVerify). */
const GiftCheckout = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth() as any;
  const { product, customization } = useRoute().params as Params;
  const [f, setF] = useState({ name: '', phone: '', line1: '', line2: '', landmark: '', city: '', state: '', pincode: '', giftNote: '' });
  const [surprise, setSurprise] = useState(false);
  const [busy, setBusy] = useState(false);
  const paying = useRef(false);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const total = priceWith(product, customization.options);

  const pay = async () => {
    // Same checks the server makes, so the common mistakes never cost a round trip.
    if (!f.name.trim() || !f.line1.trim() || !f.city.trim() || !f.state.trim()) return Toast.show({ type: 'error', text1: 'Fill in the recipient and address' });
    if (!/^[6-9]\d{9}$/.test(f.phone)) return Toast.show({ type: 'error', text1: 'Enter a valid 10-digit mobile number' });
    if (!/^[1-9]\d{5}$/.test(f.pincode)) return Toast.show({ type: 'error', text1: 'Enter a valid 6-digit pincode' });
    if (paying.current) return;
    paying.current = true;
    setBusy(true);
    try {
      const g = await axios.post('/gifts/orders', { productId: product._id, customization, shipping: { ...f, surprise } });
      // The one payment path: amount resolved server-side from the gift order.
      const o = await axios.post('/payment/order', { purpose: 'couple_gift', giftOrderId: g.data.giftOrderId });
      navigation.navigate('RazorpayWebView', { order: o.data, user, keyId: RAZORPAY_KEY_ID, merchantName: 'Fync Gifts' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.response?.data?.message || 'Could not start payment' });
    } finally {
      paying.current = false;
      setBusy(false);
    }
  };

  return (
    <Screen>
      <AppBar title="Checkout" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          <View className="mt-2 rounded-card border border-line bg-card p-4">
            <Text className="text-ink font-semibold">{product.title}</Text>
            {Object.entries(customization.options).map(([k, v]) => <Text key={k} className="text-ink-2 text-sm mt-1">{k}: {v}</Text>)}
            {!!customization.photos.length && <Text className="text-ink-2 text-sm mt-1">{customization.photos.length} photo(s)</Text>}
            {!!customization.text && <Text className="text-ink-2 text-sm mt-1" numberOfLines={2}>“{customization.text}”</Text>}
            <Text className="text-ink-3 text-xs mt-2">Estimated delivery {deliveryBy(product.deliveryDays)}</Text>
          </View>

          <Field label="Recipient name" value={f.name} onChangeText={set('name')} maxLength={60} autoComplete="name" />
          <Field label="Recipient phone (10 digits)" value={f.phone} onChangeText={(v) => set('phone')(v.replace(/\D/g, '').slice(-10))} keyboardType="number-pad" maxLength={10} />
          <Field label="House / hostel / street" value={f.line1} onChangeText={set('line1')} maxLength={150} />
          <Field label="Area (optional)" value={f.line2} onChangeText={set('line2')} maxLength={150} />
          <Field label="Landmark (optional)" value={f.landmark} onChangeText={set('landmark')} maxLength={80} />
          <View className="flex-row" style={{ gap: 12 }}>
            <View style={{ flex: 1 }}><Field label="Pincode" value={f.pincode} onChangeText={(v) => set('pincode')(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={6} /></View>
            <View style={{ flex: 1 }}><Field label="City" value={f.city} onChangeText={set('city')} maxLength={60} /></View>
          </View>
          <Field label="State" value={f.state} onChangeText={set('state')} maxLength={60} />

          <View className="mt-5 flex-row items-center justify-between rounded-card border border-line bg-card p-4">
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text className="text-ink font-semibold">Keep it a surprise</Text>
              <Text className="text-ink-3 text-xs mt-1">We won't call or message the recipient before delivery.</Text>
            </View>
            <Switch value={surprise} onValueChange={setSurprise} trackColor={{ true: C.brand[500] }} />
          </View>
          <Field label="Gift note on the package (optional)" value={f.giftNote} onChangeText={set('giftNote')} maxLength={200} multiline />
          <Text className="text-ink-3 text-xs mt-4">Your address is only visible to you and the Fync team that ships your gift.</Text>
        </ScrollView>
        <BottomBar>
          <Button title={busy ? 'Starting payment…' : `Pay ${rupees(total)}`} variant="primary" block disabled={busy} onPress={pay} />
        </BottomBar>
      </KeyboardAvoidingView>
    </Screen>
  );
};

export default GiftCheckout;
