/**
 * Admin side of Fync Store: add affiliate products and see what the listings
 * have earned. The backend already computes commission on every tracked click
 * (price x commissionRate / 100) — this screen is the missing UI for
 * POST /affiliate/add-product, which had no way to be called.
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Platform,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import axios from 'axios';
import { Alert } from '../ui/AlertModal';

const CATEGORIES = ['Education', 'Electronics', 'Fashion', 'Books', 'Lifestyle', 'Other'];

type Field = { key: string; label: string; placeholder: string; numeric?: boolean; multi?: boolean };
const FIELDS: Field[] = [
  { key: 'name', label: 'Product name', placeholder: 'Casio FX-991EX Calculator' },
  { key: 'brand', label: 'Brand', placeholder: 'Casio' },
  { key: 'description', label: 'Description', placeholder: 'What is it, and why would a student want it?', multi: true },
  { key: 'image', label: 'Image URL', placeholder: 'https://...' },
  { key: 'affiliateLink', label: 'Affiliate link', placeholder: 'https://amzn.to/...' },
  { key: 'price', label: 'Price (INR)', placeholder: '1099', numeric: true },
  { key: 'originalPrice', label: 'Original price (INR)', placeholder: '1499', numeric: true },
  { key: 'commissionRate', label: 'Commission rate (%)', placeholder: '4', numeric: true },
];

export default function AffiliateAdminScreen() {
  const navigation = useNavigation<any>();
  const [form, setForm] = useState<Record<string, string>>({});
  const [category, setCategory] = useState('Education');
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await axios.get('/affiliate/products');
      setProducts(res.data.products ?? []);
    } catch {
      // an empty catalogue and an unreachable server look the same to the user
      // otherwise, so say nothing here and let the empty state speak
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    const required = ['name', 'description', 'price', 'image', 'affiliateLink'];
    const missing = required.filter((k) => !form[k]?.trim());
    if (missing.length) {
      Alert.alert('Missing details', `Still needed: ${missing.join(', ')}.`);
      return;
    }
    const rate = Number(form.commissionRate ?? 0);
    if (Number.isNaN(rate) || rate < 0 || rate > 100) {
      Alert.alert('Check the commission', 'Commission rate must be a number between 0 and 100.');
      return;
    }
    setSaving(true);
    try {
      await axios.post('/affiliate/add-product', {
        ...form,
        price: Number(form.price),
        originalPrice: form.originalPrice ? Number(form.originalPrice) : undefined,
        commissionRate: rate,
        category,
      });
      Alert.alert('Listed', `${form.name} is now in Fync Store.`);
      setForm({});
      load();
    } catch (e: any) {
      Alert.alert('Could not add', e?.response?.data?.message ?? 'The product could not be saved.');
    } finally { setSaving(false); }
  };

  const projected = products.reduce((sum, p) => sum + (p.price * (p.commissionRate || 0)) / 100, 0);

  return (
    <View className="flex-1" style={{ backgroundColor: '#F5F2EC' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View className="px-5 py-4 flex-row items-center border-b border-line bg-transparent">
          <TouchableOpacity onPress={() => navigation.goBack()} className="w-11 h-11 items-center justify-center rounded-xl"
            accessibilityRole="button" accessibilityLabel="Go back" style={{ marginLeft: -11 }}>
            <Ionicons name="arrow-back" size={24} color="#12100E" />
          </TouchableOpacity>
          <Text className="text-xl font-display text-ink flex-1">Store Admin</Text>
        </View>

        <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#F97316" colors={['#F97316']} />}>

          {/* the one stamped card on this screen */}
          <View style={{ position: 'relative', marginBottom: 24 }}>
            <View pointerEvents="none" style={{ position: 'absolute', left: 4, top: 4, right: -4, bottom: -4, backgroundColor: '#12100E', borderRadius: 20 }} />
            <View className="bg-card border-2 border-ink rounded-card p-card-pad">
              <Text className="text-ink-3 font-display uppercase text-label mb-1">Commission per sale</Text>
              <Text className="text-ink font-display" style={{ fontSize: 34, fontVariant: ['tabular-nums'] }}>
                ₹{projected.toFixed(0)}
              </Text>
              <Text className="text-ink-2 text-sm mt-1">
                If one of each of the {products.length} listed products sells.
              </Text>
            </View>
          </View>

          <View className="flex-row items-center mt-2 mb-3" style={{ gap: 12 }}>
            <Text className="text-ink-3 text-label font-display uppercase">Add a product</Text>
            <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
          </View>

          <View className="bg-card rounded-card p-5 border border-line shadow-hair mb-5">
            {FIELDS.map((f) => (
              <View key={f.key} className="mb-4">
                <Text className="text-ink-3 font-display uppercase text-label mb-2">{f.label}</Text>
                <TextInput
                  value={form[f.key] ?? ''} onChangeText={(t) => set(f.key, t)}
                  placeholder={f.placeholder} placeholderTextColor="#8B857E"
                  keyboardType={f.numeric ? 'numeric' : 'default'}
                  autoCapitalize={f.key === 'image' || f.key === 'affiliateLink' ? 'none' : 'sentences'}
                  multiline={f.multi} textAlignVertical={f.multi ? 'top' : 'center'}
                  className="bg-card p-4 text-ink border-[1.5px] border-ink rounded-md"
                  style={{ minHeight: f.multi ? 90 : 50 }}
                />
              </View>
            ))}

            <Text className="text-ink-3 font-display uppercase text-label mb-2">Category</Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity key={c} onPress={() => setCategory(c)}
                  className={`px-4 rounded-full border-2 items-center justify-center ${category === c ? 'bg-brand-500 border-ink' : 'bg-card border-line'}`}
                  style={{ minHeight: 44 }} accessibilityRole="button">
                  <Text className={`font-display uppercase text-label ${category === c ? 'text-ink' : 'text-ink-2'}`}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity onPress={submit} disabled={saving}
            className={`w-full py-4 rounded-md items-center justify-center border-2 border-ink mb-6 ${saving ? 'bg-paper-2' : 'bg-brand-500'}`}
            accessibilityRole="button">
            {saving ? <ActivityIndicator color="#12100E" />
              : <Text className="font-display uppercase text-base text-ink">List in Fync Store</Text>}
          </TouchableOpacity>

          <View className="flex-row items-center mt-2 mb-3" style={{ gap: 12 }}>
            <Text className="text-ink-3 text-label font-display uppercase">Listed</Text>
            <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
            <Text className="text-ink-3 font-mono text-label">{products.length}</Text>
          </View>

          {products.length === 0 && !loading ? (
            <View className="items-center py-10">
              <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-3">
                <Ionicons name="pricetags-outline" size={32} color="#57534E" />
              </View>
              <Text className="text-ink-2 text-sm">Nothing listed yet.</Text>
            </View>
          ) : products.map((p) => (
            <View key={p._id} className="flex-row items-center bg-card rounded-card p-4 border border-line mb-2">
              <View className="flex-1">
                <Text className="text-ink text-sm" numberOfLines={1}>{p.name}</Text>
                <Text className="text-ink-3 text-label mt-0.5">
                  ₹{p.price} · {p.commissionRate || 0}% · ₹{((p.price * (p.commissionRate || 0)) / 100).toFixed(0)} per sale
                </Text>
              </View>
              <Ionicons name={p.isAvailable ? 'checkmark-circle' : 'pause-circle'} size={20} color={p.isAvailable ? '#047857' : '#8B857E'} />
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
