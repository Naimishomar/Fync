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
import { Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
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
  { key: 'affiliateLink', label: 'Affiliate link', placeholder: 'https://amzn.to/...' },
  { key: 'price', label: 'Price (INR)', placeholder: '1099', numeric: true },
  { key: 'originalPrice', label: 'Original price (INR)', placeholder: '1499', numeric: true },
  { key: 'commissionRate', label: 'Commission rate (%)', placeholder: '4', numeric: true },
];

export default function AffiliateAdminScreen() {
  const navigation = useNavigation<any>();
  const [form, setForm] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [category, setCategory] = useState('Education');
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Gallery access needed', 'Allow photo access to pick a product image.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      // Product tiles are square, so cropping here is what stops the store
      // grid from showing letterboxed photos.
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!res.canceled && res.assets?.[0]) setPhoto(res.assets[0]);
  };

  const load = useCallback(async () => {
    try {
      // delisted ones too, so they can be brought back
      const res = await axios.get('/affiliate/products', { params: { includeDelisted: true } });
      setProducts(res.data.products ?? []);
    } catch {
      // an empty catalogue and an unreachable server look the same to the user
      // otherwise, so say nothing here and let the empty state speak
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    const required = ['name', 'description', 'price', 'affiliateLink'];
    const missing = required.filter((k) => !form[k]?.trim());
    if (missing.length) {
      Alert.alert('Missing details', `Still needed: ${missing.join(', ')}.`);
      return;
    }
    if (!photo) {
      Alert.alert('Add a photo', 'Pick a product image from your gallery.');
      return;
    }
    const rate = Number(form.commissionRate ?? 0);
    if (Number.isNaN(rate) || rate < 0 || rate > 100) {
      Alert.alert('Check the commission', 'Commission rate must be a number between 0 and 100.');
      return;
    }
    setSaving(true);
    try {
      // multipart, because the photo is a file now rather than a URL string
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v?.trim()) body.append(k, v.trim()); });
      body.append('commissionRate', String(rate));
      body.append('category', category);
      body.append('image', {
        uri: photo.uri,
        name: photo.fileName ?? 'product.jpg',
        type: photo.mimeType ?? 'image/jpeg',
      } as any);

      await axios.post('/affiliate/add-product', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      Alert.alert('Listed', `${form.name} is now in Fync Store.`);
      setForm({});
      setPhoto(null);
      load();
    } catch (e: any) {
      Alert.alert('Could not add', e?.response?.data?.message ?? 'The product could not be saved.');
    } finally { setSaving(false); }
  };

  const live = products.filter((p) => p.isAvailable);
  const projected = live.reduce((sum, p) => sum + (p.price * (p.commissionRate || 0)) / 100, 0);

  const toggle = async (p: any) => {
    const next = !p.isAvailable;
    // Flip the row immediately; waiting on a refetch made the list look frozen.
    setProducts((prev) => prev.map((x) => (x._id === p._id ? { ...x, isAvailable: next } : x)));
    try {
      await axios.patch(`/affiliate/products/${p._id}/availability`, { isAvailable: next });
      Alert.alert(
        next ? 'Back in the store' : 'Delisted',
        `"${p.name}" is ${next ? 'visible to students again' : 'hidden from the store'}.`,
      );
    } catch (e: any) {
      // Put it back: the server is the source of truth, not the optimistic flip.
      setProducts((prev) => prev.map((x) => (x._id === p._id ? { ...x, isAvailable: !next } : x)));
      Alert.alert('Could not update', e?.response?.data?.message ?? 'Please try again.');
    }
  };

  const remove = (p: any) =>
    Alert.alert(
      'Delete product',
      `Remove "${p.name}" from Fync Store permanently? Any commission already recorded for it is kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const snapshot = products;
            // Drop the row on tap rather than after a refetch round trip.
            setProducts((prev) => prev.filter((x) => x._id !== p._id));
            try {
              const res = await axios.delete(`/affiliate/products/${p._id}`);
              Alert.alert('Deleted', res.data?.message ?? `"${p.name}" was removed.`);
            } catch (e: any) {
              setProducts(snapshot);
              Alert.alert('Not deleted', e?.response?.data?.message ?? 'Please try again.');
            }
          },
        },
      ],
    );

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
                If one of each of the {live.length} live products sells.
              </Text>
            </View>
          </View>

          <View className="flex-row items-center mt-2 mb-3" style={{ gap: 12 }}>
            <Text className="text-ink-3 text-label font-display uppercase">Add a product</Text>
            <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
          </View>

          <View className="bg-card rounded-card p-5 border border-line shadow-hair mb-5">
            <View className="mb-4">
              <Text className="text-ink-3 font-display uppercase text-label mb-2">Product photo</Text>
              <TouchableOpacity
                onPress={pickPhoto}
                className="rounded-card border border-line overflow-hidden items-center justify-center bg-paper"
                style={{ height: 160 }}
                accessibilityRole="button"
                accessibilityLabel={photo ? 'Change product photo' : 'Pick product photo from gallery'}
              >
                {photo ? (
                  <Image source={{ uri: photo.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                ) : (
                  <>
                    <Ionicons name="image-outline" size={34} color="#8B857E" />
                    <Text className="text-ink-3 font-sans mt-2" style={{ fontSize: 13 }}>
                      Pick from gallery
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              {!!photo && (
                <TouchableOpacity onPress={pickPhoto} className="mt-2 self-start" style={{ minHeight: 32 }}>
                  <Text className="text-brand-600 font-display uppercase text-label">Change photo</Text>
                </TouchableOpacity>
              )}
            </View>

            {FIELDS.map((f) => (
              <View key={f.key} className="mb-4">
                <Text className="text-ink-3 font-display uppercase text-label mb-2">{f.label}</Text>
                <TextInput
                  value={form[f.key] ?? ''} onChangeText={(t) => set(f.key, t)}
                  placeholder={f.placeholder} placeholderTextColor="#8B857E"
                  keyboardType={f.numeric ? 'numeric' : 'default'}
                  autoCapitalize={f.key === 'affiliateLink' ? 'none' : 'sentences'}
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
            <View key={p._id} className={`bg-card rounded-card p-4 border mb-2 ${p.isAvailable ? 'border-line' : 'border-ink-4'}`}>
              <View className="flex-row items-center">
                <View className="flex-1">
                  <Text className={`text-sm ${p.isAvailable ? 'text-ink' : 'text-ink-3'}`} numberOfLines={1}>{p.name}</Text>
                  <Text className="text-ink-3 text-label mt-0.5">
                    ₹{p.price} · {p.commissionRate || 0}% · ₹{((p.price * (p.commissionRate || 0)) / 100).toFixed(0)} per sale
                  </Text>
                </View>
                {!p.isAvailable && (
                  <View className="bg-paper-2 px-2.5 py-1 rounded-full">
                    <Text className="text-ink-2 text-label font-display uppercase">Delisted</Text>
                  </View>
                )}
              </View>

              <View className="flex-row mt-3" style={{ gap: 10 }}>
                <TouchableOpacity
                  onPress={() => toggle(p)}
                  className="flex-1 flex-row items-center justify-center bg-card border-[1.5px] border-line rounded-md"
                  style={{ minHeight: 44 }}
                  accessibilityRole="button"
                  accessibilityLabel={p.isAvailable ? `Delist ${p.name}` : `Relist ${p.name}`}
                >
                  <Ionicons name={p.isAvailable ? 'eye-off-outline' : 'eye-outline'} size={16} color="#12100E" style={{ marginRight: 7 }} />
                  <Text className="font-display text-ink uppercase" style={{ fontSize: 12 }}>
                    {p.isAvailable ? 'Delist' : 'Relist'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => remove(p)}
                  className="flex-1 flex-row items-center justify-center bg-danger border-2 border-ink rounded-md"
                  style={{ minHeight: 44 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${p.name}`}
                >
                  <Ionicons name="trash-outline" size={16} color="#FFFFFF" style={{ marginRight: 7 }} />
                  <Text className="font-display text-white uppercase" style={{ fontSize: 12 }}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
