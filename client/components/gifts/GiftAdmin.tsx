import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, TextInput, ScrollView, Switch, ActivityIndicator, Linking } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import axios from '../../context/axiosConfig';
import { C } from '../../constants/colors';
import { Button, Chip, ChipRow, Empty, Label, Num, Tabs, IconBtn, ListRow, Sheet, FormField } from '../ui/kit';
import { Alert } from '../ui/AlertModal';
import { GiftOrder, GiftProduct, rupees, optValue, STATUS_LABEL, uploadGiftPhotos } from './shared';

/**
 * Admin Portal → Gift Shop. Rendered inside AdminPortal (which already gates on
 * user_access === 'admin'; the /gifts/admin/* routes enforce it again).
 */

// Mirrors backend/utils/giftRules.js — the server is the one that enforces it.
const NEXT: Record<string, string[]> = {
  paid: ['in_production', 'cancelled', 'refunded'],
  in_production: ['shipped', 'cancelled', 'refunded'],
  shipped: ['delivered', 'refunded'],
  delivered: ['refunded'],
  cancelled: ['refunded'],
};
const FILTERS = ['', 'paid', 'in_production', 'shipped', 'delivered', 'cancelled', 'refunded'];

// Label is optional: the tracking inputs go by their placeholder.
const Input = ({ label, ...p }: React.ComponentProps<typeof TextInput> & { label?: string }) => (
  <FormField label={label} accessibilityLabel={label ?? p.placeholder} containerStyle={{ marginBottom: 12 }} {...p} />
);

/* ------------------------------------------------------------------ orders */

const OrderCard = ({ o, onSaved }: { o: GiftOrder; onSaved: (o: GiftOrder) => void }) => {
  const [open, setOpen] = useState(false);
  const [courier, setCourier] = useState(o.tracking?.courier ?? '');
  const [awb, setAwb] = useState(o.tracking?.awb ?? '');
  const [url, setUrl] = useState(o.tracking?.url ?? '');
  const [saving, setSaving] = useState(false);
  const s = o.shipping;
  const address = s ? [s.name, s.phone, s.line1, s.line2, s.landmark, `${s.city}, ${s.state} ${s.pincode}`].filter(Boolean).join('\n') : '';

  const save = async (status?: string) => {
    setSaving(true);
    try {
      const r = await axios.patch(`/gifts/admin/orders/${o._id}`, { status, tracking: { courier, awb, url } });
      onSaved({ ...o, ...r.data.order, buyer: o.buyer });
      Toast.show({ type: 'success', text1: status ? `Marked ${STATUS_LABEL[status]}` : 'Tracking saved' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.response?.data?.message || 'Update failed' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Pressable
      onPress={() => setOpen((v) => !v)}
      className="mb-3 rounded-2xl border border-line bg-card p-4 active:opacity-85"
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-ink font-semibold flex-1" numberOfLines={1}>{o.productSnapshot.title}</Text>
        <Num style={{ fontSize: 15 }}>{rupees(o.amount)}</Num>
      </View>
      <Text className="text-ink-2 text-xs mt-1">
        {STATUS_LABEL[o.status]} · {new Date(o.paidAt || o.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        {' · '}{o.buyer?.name || o.buyer?.username || 'Unknown buyer'}
      </Text>
      {open && (
        <View className="mt-3">
          <Label>Customization</Label>
          {Object.entries(o.customization.options ?? {}).map(([k, v]) => <Text key={k} className="text-ink text-sm mt-1">{k}: {v}</Text>)}
          {!!o.customization.text && <Text className="text-ink text-sm mt-1">Text: “{o.customization.text}”</Text>}
          {!!o.customization.photos?.length && (
            <ScrollView horizontal className="mt-2" contentContainerStyle={{ gap: 8 }}>
              {o.customization.photos.map((p) => (
                // Opens the full-size file in the browser, where it can be saved.
                <Pressable key={p} onPress={() => Linking.openURL(p)} accessibilityRole="button" accessibilityLabel="Open photo">
                  <Image source={{ uri: p }} style={{ width: 72, height: 72, borderRadius: 12 }} contentFit="cover" cachePolicy="memory-disk" />
                </Pressable>
              ))}
            </ScrollView>
          )}

          <View className="flex-row items-center justify-between mt-4">
            <Label>Ship to</Label>
            <IconBtn name="copy-outline" size={18} color={C.ink2} accessibilityLabel="Copy address" style={{ marginRight: -11 }}
              onPress={() => { Clipboard.setStringAsync(address); Toast.show({ type: 'success', text1: 'Address copied' }); }} />
          </View>
          <Text className="text-ink text-sm mt-1" selectable>{address}</Text>
          {s?.surprise && <Text style={{ color: C.danger, fontSize: 12, marginTop: 4, fontFamily: 'Inter_600SemiBold' }}>Surprise: do not contact the recipient before delivery</Text>}
          {!!s?.giftNote && <Text className="text-ink-2 text-sm mt-1">Gift note: “{s.giftNote}”</Text>}
          {o.buyer?.email && <Text className="text-ink-3 text-xs mt-1">Buyer: {o.buyer.email}</Text>}

          <Label style={{ marginTop: 16, marginBottom: 8 }}>Tracking</Label>
          <Input placeholder="Courier (e.g. Delhivery)" value={courier} onChangeText={setCourier} maxLength={60} />
          <Input placeholder="AWB number" value={awb} onChangeText={setAwb} maxLength={60} />
          <Input placeholder="Tracking link (https://…)" value={url} onChangeText={setUrl} maxLength={300} autoCapitalize="none" keyboardType="url" />
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            <Button title="Save tracking" small disabled={saving} onPress={() => save()} />
            {(NEXT[o.status] ?? []).map((n) => (
              <Button key={n} small disabled={saving} variant={n === 'cancelled' || n === 'refunded' ? 'ghost' : 'solid'}
                title={`→ ${STATUS_LABEL[n]}`}
                onPress={() => (n === 'cancelled' || n === 'refunded'
                  ? Alert.alert(`Mark ${STATUS_LABEL[n]}?`, n === 'refunded' ? 'Issue the refund in Razorpay first; this only updates the order.' : 'The buyer is notified.', [
                      { text: 'Back', style: 'cancel' }, { text: 'Confirm', onPress: () => save(n) }])
                  : save(n))} />
            ))}
          </View>
        </View>
      )}
    </Pressable>
  );
};

const Orders = () => {
  const [filter, setFilter] = useState('');
  const [orders, setOrders] = useState<GiftOrder[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (more = false) => {
    try {
      const before = more ? orders[orders.length - 1]?.createdAt : undefined;
      const r = await axios.get('/gifts/admin/orders', { params: { status: filter || undefined, before } });
      setOrders((prev) => (more ? [...prev, ...r.data.orders] : r.data.orders));
      setHasMore(r.data.hasMore);
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to load gift orders' });
    } finally {
      setLoading(false);
    }
  }, [filter, orders]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setLoading(true); load(false); }, [filter]);

  return (
    <FlatList
      data={orders}
      keyExtractor={(o) => o._id}
      contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
      ListHeaderComponent={
        <ChipRow style={{ marginHorizontal: -20, marginBottom: 12 }}>
          {FILTERS.map((f) => <Chip key={f || 'all'} label={f ? STATUS_LABEL[f] : 'All'} active={filter === f} onPress={() => setFilter(f)} />)}
        </ChipRow>
      }
      ListEmptyComponent={loading ? <ActivityIndicator color={C.ink3} /> : <Empty icon="gift-outline" title="No paid gift orders" />}
      ListFooterComponent={hasMore ? <Button title="Load more" block onPress={() => load(true)} /> : null}
      renderItem={({ item }) => <OrderCard o={item} onSaved={(n) => setOrders((all) => all.map((x) => (x._id === n._id ? n : x)))} />}
    />
  );
};

/* ---------------------------------------------------------------- products */

// "Size: A5, A4 +200" per line ⇄ [{ name, values: [{ label, add (paise) }] }]
const optionsToText = (p?: GiftProduct) =>
  (p?.customization?.options ?? []).map((o) => `${o.name}: ${o.values.map(optValue).map((v) => (v.add ? `${v.label} +${v.add / 100}` : v.label)).join(', ')}`).join('\n');
const textToOptions = (t: string) =>
  t.split('\n').map((line) => {
    const i = line.indexOf(':');
    if (i < 1) return null;
    const values = line.slice(i + 1).split(',').map((raw) => {
      const m = raw.trim().match(/^(.*?)\s*(?:\+\s*(\d+(?:\.\d+)?))?$/);
      return m && m[1] ? { label: m[1].trim(), add: Math.round(Number(m[2] || 0) * 100) } : null;
    }).filter(Boolean);
    return values.length ? { name: line.slice(0, i).trim(), values } : null;
  }).filter(Boolean);

const ProductForm = ({ product, onClose, onSaved }: { product: GiftProduct | null; onClose: () => void; onSaved: () => void }) => {
  const cz = product?.customization ?? {};
  const [v, setV] = useState({
    title: product?.title ?? '', description: product?.description ?? '', category: product?.category ?? '',
    price: product ? String(product.price / 100) : '', deliveryDays: String(product?.deliveryDays ?? 7),
    photosMin: String(cz.photos?.min ?? 0), photosMax: String(cz.photos?.max ?? 0),
    textLabel: cz.text?.label ?? '', textMax: String(cz.text?.maxLen ?? 0), options: optionsToText(product ?? undefined),
  });
  const [textRequired, setTextRequired] = useState(!!cz.text?.required);
  const [active, setActive] = useState(product?.active ?? true);
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (t: string) => setV((s) => ({ ...s, [k]: t }));

  const addImages = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 8 - images.length, quality: 0.9 });
    if (r.canceled) return;
    setBusy(true);
    try {
      const urls = await uploadGiftPhotos(r.assets.map((a) => a.uri));
      setImages((s) => [...s, ...urls].slice(0, 8));
    } catch {
      Toast.show({ type: 'error', text1: 'Image upload failed' });
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const price = Math.round(Number(v.price) * 100);
    if (!v.title.trim() || !(price >= 100)) return Toast.show({ type: 'error', text1: 'Title and a price of at least ₹1 are required' });
    const body = {
      title: v.title, description: v.description, category: v.category, price, deliveryDays: Number(v.deliveryDays) || 7,
      images, active,
      customization: {
        photos: Number(v.photosMax) > 0 ? { min: Number(v.photosMin) || 0, max: Number(v.photosMax) } : null,
        text: Number(v.textMax) > 0 ? { label: v.textLabel || 'Message', maxLen: Number(v.textMax), required: textRequired } : null,
        options: textToOptions(v.options),
      },
    };
    setBusy(true);
    try {
      if (product) await axios.patch(`/gifts/admin/products/${product._id}`, body);
      else await axios.post('/gifts/admin/products', body);
      Toast.show({ type: 'success', text1: 'Saved' });
      onSaved();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.response?.data?.message || 'Save failed' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={product ? 'Edit gift' : 'New gift'}
      height="92%"
      footer={<Button title="Save gift" variant="primary" block loading={busy} disabled={busy} onPress={save} />}
    >
      <Label>Images</Label>
      <ScrollView horizontal keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
        {images.map((u, i) => (
          <Pressable key={u + i} onLongPress={() => setImages((s) => s.filter((_, j) => j !== i))} accessibilityLabel={`Image ${i + 1}, long-press to remove`}>
            <Image source={{ uri: u }} style={{ width: 72, height: 72, borderRadius: 12 }} contentFit="cover" />
          </Pressable>
        ))}
        {images.length < 8 && (
          <Pressable onPress={addImages} accessibilityRole="button" accessibilityLabel="Add images"
            className="items-center justify-center rounded-2xl border border-dashed border-line bg-paper-2 active:opacity-85" style={{ width: 72, height: 72 }}>
            {busy ? <ActivityIndicator color={C.ink3} /> : <Ionicons name="add" size={24} color={C.ink3} />}
          </Pressable>
        )}
      </ScrollView>
      <Text className="text-ink-3 text-xs mb-3">Long-press an image to remove it.</Text>
      <Input label="Title" value={v.title} onChangeText={set('title')} maxLength={80} />
      <Input label="Description" value={v.description} onChangeText={set('description')} maxLength={1000} multiline />
      <Input label="Category" value={v.category} onChangeText={set('category')} maxLength={30} placeholder="Albums, Mugs, Prints…" />
      <View className="flex-row" style={{ gap: 12 }}>
        <View style={{ flex: 1 }}><Input label="Price (₹)" value={v.price} onChangeText={set('price')} keyboardType="decimal-pad" /></View>
        <View style={{ flex: 1 }}><Input label="Delivery days" value={v.deliveryDays} onChangeText={set('deliveryDays')} keyboardType="number-pad" /></View>
      </View>
      <View className="flex-row" style={{ gap: 12 }}>
        <View style={{ flex: 1 }}><Input label="Min photos" value={v.photosMin} onChangeText={set('photosMin')} keyboardType="number-pad" /></View>
        <View style={{ flex: 1 }}><Input label="Max photos (0 = none)" value={v.photosMax} onChangeText={set('photosMax')} keyboardType="number-pad" /></View>
      </View>
      <View className="flex-row" style={{ gap: 12 }}>
        <View style={{ flex: 2 }}><Input label="Text label" value={v.textLabel} onChangeText={set('textLabel')} maxLength={60} placeholder="Message" /></View>
        <View style={{ flex: 1 }}><Input label="Max chars (0 = none)" value={v.textMax} onChangeText={set('textMax')} keyboardType="number-pad" /></View>
      </View>
      <View className="flex-row items-center justify-between mb-3" style={{ minHeight: 44 }}>
        <Text className="text-ink text-sm">Text required</Text>
        <Switch value={textRequired} onValueChange={setTextRequired} accessibilityLabel="Text required" />
      </View>
      <Input label={'Options (one per line; "+200" = ₹200 extra)'} value={v.options} onChangeText={set('options')} multiline placeholder={'Size: A5, A4 +200\nFrame: Black, White, Wood +100'} autoCapitalize="none" />
      <View className="flex-row items-center justify-between" style={{ minHeight: 44 }}>
        <Text className="text-ink text-sm">Visible in shop</Text>
        <Switch value={active} onValueChange={setActive} accessibilityLabel="Visible in shop" />
      </View>
    </Sheet>
  );
};

const Products = () => {
  const [products, setProducts] = useState<GiftProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<GiftProduct | null | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const r = await axios.get('/gifts/admin/products');
      setProducts(r.data.products ?? []);
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to load gift products' });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const remove = (p: GiftProduct) =>
    Alert.alert('Delete gift?', `"${p.title}" will be removed from the shop. Existing orders keep their details.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await axios.delete(`/gifts/admin/products/${p._id}`); load(); } catch { Toast.show({ type: 'error', text1: 'Delete failed' }); }
      } },
    ]);

  return (
    <>
      <FlatList
        data={products}
        keyExtractor={(p) => p._id}
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        ListHeaderComponent={<Button title="Add gift" icon="add" variant="primary" block style={{ marginBottom: 16 }} onPress={() => setEditing(null)} />}
        ListEmptyComponent={loading ? <ActivityIndicator color={C.ink3} /> : <Empty icon="gift-outline" title="No products" />}
        renderItem={({ item: p }) => (
          <ListRow
            onPress={() => setEditing(p)}
            style={{ marginBottom: 12, paddingHorizontal: 12, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line }}
            leading={
              <View style={{ width: 52, height: 52, borderRadius: 12, overflow: 'hidden', backgroundColor: C.paper2 }}>
                {p.images?.[0] ? <Image source={{ uri: p.images[0] }} style={{ width: 52, height: 52 }} contentFit="cover" cachePolicy="memory-disk" /> : null}
              </View>
            }
            title={p.title}
            subtitle={`${rupees(p.price)} · ${p.category} · ${p.deliveryDays}d${p.active ? '' : ' · hidden'}`}
            right={<IconBtn name="trash-outline" size={18} color={C.danger} onPress={() => remove(p)} accessibilityLabel={`Delete ${p.title}`} />}
          />
        )}
      />
      {editing !== undefined && (
        <ProductForm product={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); load(); }} />
      )}
    </>
  );
};

const GiftAdmin = () => {
  const [tab, setTab] = useState('Orders');
  return (
    <View style={{ flex: 1 }}>
      <View className="px-gutter"><Tabs items={['Orders', 'Products']} value={tab} onChange={setTab} /></View>
      {tab === 'Orders' ? <Orders /> : <Products />}
    </View>
  );
};

export default GiftAdmin;
