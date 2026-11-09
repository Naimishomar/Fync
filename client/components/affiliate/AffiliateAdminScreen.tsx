/**
 * Admin side of Fync Store: add affiliate products and see what the listings
 * have earned. The backend already computes commission on every tracked click
 * (price x commissionRate / 100) — this screen is the missing UI for
 * POST /affiliate/add-product, which had no way to be called.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Platform } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import axios from 'axios';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar, Card, Label, Num, SectionHeader, Button, Chip, Tag, Empty, FormField } from '../ui/kit';

import FyncRefreshControl from '../ui/FyncRefreshControl';
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
      allowsEditing: Platform.OS === 'ios',
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
    <View className="flex-1 bg-paper">
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <AppBar title="Store admin" onBack={() => navigation.goBack()} />

        <ScrollView keyboardShouldPersistTaps="handled" className="flex-1 px-gutter pt-4" showsVerticalScrollIndicator={false}
          refreshControl={<FyncRefreshControl refreshing={loading} onRefresh={load} tintColor={C.brand[500]} colors={[C.brand[500]]} />}>

          <Card padded>
            <Label>Commission per sale</Label>
            <Num style={{ fontSize: 34, lineHeight: 40, marginTop: 4 }}>₹{projected.toFixed(0)}</Num>
            <Text className="text-ink-2 text-sm mt-1">
              If one of each of the {live.length} live products sells.
            </Text>
          </Card>

          <SectionHeader title="Add a product" />

          <Card padded style={{ gap: 16 }}>
            <View>
              <Text className="text-ink-2 font-semibold text-sm mb-2">Product photo</Text>
              <Pressable
                onPress={pickPhoto}
                className="rounded-2xl border border-line overflow-hidden items-center justify-center bg-paper-2 active:opacity-85"
                style={{ height: 160 }}
                accessibilityRole="button"
                accessibilityLabel={photo ? 'Change product photo' : 'Pick product photo from gallery'}
              >
                {photo ? (
                  <Image source={{ uri: photo.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                ) : (
                  <>
                    <Ionicons name="image-outline" size={32} color={C.ink3} />
                    <Text className="text-ink-3 text-sm mt-2">Pick from gallery</Text>
                  </>
                )}
              </Pressable>
              {!!photo && (
                <Button small variant="tertiary" title="Change photo" onPress={pickPhoto} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
              )}
            </View>

            {FIELDS.map((f) => (
              <FormField
                key={f.key}
                label={f.label}
                value={form[f.key] ?? ''} onChangeText={(t) => set(f.key, t)}
                placeholder={f.placeholder}
                keyboardType={f.numeric ? 'numeric' : 'default'}
                autoCapitalize={f.key === 'affiliateLink' ? 'none' : 'sentences'}
                multiline={f.multi}
              />
            ))}

            <View>
              <Text className="text-ink-2 font-semibold text-sm mb-2">Category</Text>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {CATEGORIES.map((c) => (
                  <Chip key={c} label={c} active={category === c} onPress={() => setCategory(c)} />
                ))}
              </View>
            </View>
          </Card>

          <Button variant="primary" block title="List in Fync Store" onPress={submit} loading={saving} style={{ marginTop: 16 }} />

          <SectionHeader title="Listed" count={products.length} />

          {products.length === 0 && !loading ? (
            <Empty icon="pricetags-outline" title="Nothing listed yet" />
          ) : products.map((p) => (
            <Card key={p._id} padded style={{ marginBottom: 12 }}>
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <View className="flex-1" style={{ minWidth: 0 }}>
                  <Text className={`text-sm font-semibold ${p.isAvailable ? 'text-ink' : 'text-ink-3'}`} numberOfLines={1}>{p.name}</Text>
                  <Text className="text-ink-3 text-xs mt-0.5">
                    ₹{p.price} · {p.commissionRate || 0}% · ₹{((p.price * (p.commissionRate || 0)) / 100).toFixed(0)} per sale
                  </Text>
                </View>
                {!p.isAvailable && <Tag label="Delisted" icon="eye-off-outline" />}
              </View>

              <View className="flex-row mt-3" style={{ gap: 8 }}>
                <Button
                  small
                  icon={p.isAvailable ? 'eye-off-outline' : 'eye-outline'}
                  title={p.isAvailable ? 'Delist' : 'Relist'}
                  onPress={() => toggle(p)}
                  accessibilityLabel={p.isAvailable ? `Delist ${p.name}` : `Relist ${p.name}`}
                  style={{ flex: 1, minHeight: 44 }}
                />
                <Button
                  small
                  variant="danger"
                  icon="trash-outline"
                  title="Delete"
                  onPress={() => remove(p)}
                  accessibilityLabel={`Delete ${p.name}`}
                  style={{ flex: 1, minHeight: 44 }}
                />
              </View>
            </Card>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
