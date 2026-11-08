import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, useWindowDimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import axios from '../../context/axiosConfig';
import { C } from '../../constants/colors';
import { AppBar, Screen, Chip, Button, BottomBar, Empty, Label, Num, FormField } from '../ui/kit';
import { GiftProduct as Product, rupees, optValue, priceWith, deliveryBy, uploadGiftOriginals } from './shared';

/** One gift: gallery, price, delivery estimate and the customization form. */
const GiftProduct = () => {
  const navigation = useNavigation<any>();
  const { id } = (useRoute().params ?? {}) as { id: string };
  const { width } = useWindowDimensions();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(0);

  useEffect(() => {
    axios.get(`/gifts/products/${id}`)
      .then((r) => {
        const p: Product = r.data.product;
        setProduct(p);
        // Preselect the first value of every option — the cheapest is listed first by convention.
        setPicked(Object.fromEntries((p.customization?.options ?? []).map((o) => [o.name, optValue(o.values[0]).label])));
      })
      .catch((e) => setError(e?.response?.data?.message || "Couldn't load this gift"));
  }, [id]);

  if (!product) {
    return (
      <Screen>
        <AppBar title="Gift" onBack={() => navigation.goBack()} />
        {error ? <Empty icon="gift-outline" title={error} /> : <ActivityIndicator style={{ marginTop: 40 }} color={C.ink3} />}
      </Screen>
    );
  }

  const cz = product.customization ?? {};
  const maxPhotos = cz.photos?.max ?? 0;
  const minPhotos = cz.photos?.min ?? 0;
  const total = priceWith(product, picked);

  const pickPhotos = async () => {
    const left = maxPhotos - photos.length;
    if (left <= 0) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsMultipleSelection: left > 1, selectionLimit: left, quality: 1, // full quality: these get printed
    });
    if (!res.canceled) setPhotos((prev) => [...prev, ...res.assets.map((a) => a.uri)].slice(0, maxPhotos));
  };

  const proceed = async () => {
    if (photos.length < minPhotos) return Toast.show({ type: 'error', text1: `Add at least ${minPhotos} photo${minPhotos === 1 ? '' : 's'}` });
    if (cz.text?.required && !text.trim()) return Toast.show({ type: 'error', text1: `${cz.text.label} is required` });
    setBusy(true);
    try {
      const urls = photos.length ? await uploadGiftOriginals(photos, (d) => setSent(d)) : [];
      navigation.navigate('GiftCheckout', { product, customization: { photos: urls, text: text.trim(), options: picked } });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.response?.data?.message || 'Photo upload failed. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <AppBar title={product.title} onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}>
            {(product.images.length ? product.images : ['']).map((uri, i) => (
              <View key={i} style={{ width, aspectRatio: 1, backgroundColor: C.paper2, alignItems: 'center', justifyContent: 'center' }}>
                {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="memory-disk" /> : <Ionicons name="gift-outline" size={64} color={C.ink3} />}
              </View>
            ))}
          </ScrollView>
          {product.images.length > 1 && (
            <View className="flex-row justify-center mt-2" style={{ gap: 6 }}>
              {product.images.map((_, i) => <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: i === page ? C.ink : C.ink4 }} />)}
            </View>
          )}

          <View className="px-gutter mt-4">
            <Text className="text-ink font-display text-h1">{product.title}</Text>
            <Num style={{ fontSize: 24, marginTop: 8 }}>{rupees(total)}</Num>
            <View className="flex-row items-center mt-2">
              <Ionicons name="cube-outline" size={16} color={C.success} />
              <Text className="text-ink-2 text-sm ml-1.5">Delivered by {deliveryBy(product.deliveryDays)}</Text>
            </View>
            {!!product.description && <Text className="text-ink-2 mt-3" style={{ fontSize: 15, lineHeight: 22 }}>{product.description}</Text>}

            {(cz.options ?? []).map((o) => (
              <View key={o.name} className="mt-5">
                <Label>{o.name}</Label>
                <View className="flex-row flex-wrap mt-2" style={{ gap: 8 }}>
                  {o.values.map(optValue).map((v) => (
                    <Chip key={v.label} label={v.add ? `${v.label} +${rupees(v.add)}` : v.label}
                      active={picked[o.name] === v.label} onPress={() => setPicked((p) => ({ ...p, [o.name]: v.label }))} />
                  ))}
                </View>
              </View>
            ))}

            {maxPhotos > 0 && (
              <View className="mt-5">
                <Label>Your photos ({photos.length}/{maxPhotos}{minPhotos ? `, min ${minPhotos}` : ''})</Label>
                <View className="flex-row flex-wrap mt-2" style={{ gap: 8 }}>
                  {photos.map((uri, i) => (
                    <View key={uri + i} style={{ width: 76, height: 76 }}>
                      <Image source={{ uri }} style={{ width: 76, height: 76, borderRadius: 12 }} contentFit="cover" />
                      <Pressable onPress={() => setPhotos((p) => p.filter((_, j) => j !== i))} hitSlop={14} accessibilityRole="button" accessibilityLabel="Remove photo"
                        style={{ position: 'absolute', top: -6, right: -6, backgroundColor: C.ink, borderRadius: 12 }}>
                        <Ionicons name="close" size={16} color={C.paper} />
                      </Pressable>
                    </View>
                  ))}
                  {photos.length < maxPhotos && (
                    <Pressable onPress={pickPhotos} accessibilityRole="button" accessibilityLabel="Add photos"
                      className="items-center justify-center rounded-2xl border border-dashed border-line bg-paper-2 active:opacity-70" style={{ width: 76, height: 76 }}>
                      <Ionicons name="add" size={26} color={C.ink3} />
                    </Pressable>
                  )}
                </View>
              </View>
            )}

            {cz.text && (
              <FormField
                containerStyle={{ marginTop: 20 }}
                label={`${cz.text.label}${cz.text.required ? ' (required)' : ''}`}
                hint={`${text.length}/${cz.text.maxLen}`}
                value={text}
                onChangeText={setText}
                maxLength={cz.text.maxLen}
                multiline={cz.text.maxLen > 40}
                placeholder={cz.text.label}
              />
            )}
          </View>
        </ScrollView>
        <BottomBar>
          <Button title={busy ? `Uploading photos ${Math.min(sent + 1, photos.length)}/${photos.length}…` : `Continue · ${rupees(total)}`} variant="primary" block disabled={busy} onPress={proceed} />
        </BottomBar>
      </KeyboardAvoidingView>
    </Screen>
  );
};

export default GiftProduct;
