import axios from '../../context/axiosConfig';
import { compressImages } from '../../utils/mediaUpload';

export type OptionValue = { label: string; add: number };
export type GiftCustomization = {
  photos?: { min: number; max: number } | null;
  text?: { label: string; maxLen: number; required?: boolean } | null;
  options?: Array<{ name: string; values: Array<OptionValue | string> }>;
};
export type GiftProduct = {
  _id: string; title: string; description: string; images: string[]; price: number;
  category: string; customization: GiftCustomization; deliveryDays: number; active: boolean;
};
export type GiftOrder = {
  _id: string; status: string; amount: number; createdAt: string; paidAt?: string;
  productSnapshot: { title: string; price: number; image?: string; deliveryDays?: number };
  customization: { photos: string[]; text?: string; options?: Record<string, string> };
  shipping?: {
    name: string; phone: string; line1: string; line2?: string; landmark?: string;
    city: string; state: string; pincode: string; surprise?: boolean; giftNote?: string;
  };
  tracking?: { courier?: string; awb?: string; url?: string };
  statusHistory: Array<{ status: string; at: string; note?: string }>;
  buyer?: { _id: string; name?: string; username?: string; email?: string };
};

/** Paise → "₹1,299". */
export const rupees = (paise: number) => '₹' + Math.round((paise || 0) / 100).toLocaleString('en-IN');

export const optValue = (v: OptionValue | string): OptionValue => (typeof v === 'string' ? { label: v, add: 0 } : v);

/** Mirrors backend/utils/giftRules.js priceFor — display only; the server charges its own figure. */
export const priceWith = (p: GiftProduct, picked: Record<string, string>) =>
  p.price + (p.customization?.options ?? []).reduce((sum, o) => {
    const v = o.values.map(optValue).find((x) => x.label === picked[o.name]);
    return sum + Math.max(0, v?.add ?? 0);
  }, 0);

export const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Awaiting payment', paid: 'Order placed', in_production: 'Being made',
  shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled', refunded: 'Refunded',
};
export const TIMELINE = ['paid', 'in_production', 'shipped', 'delivered'];

/** Compress then upload device photos through /gifts/upload (R2). Returns public URLs. */
export const uploadGiftPhotos = async (uris: string[]): Promise<string[]> => {
  const small = await compressImages(uris);
  const out: string[] = [];
  for (let i = 0; i < small.length; i += 10) {
    const fd = new FormData();
    small.slice(i, i + 10).forEach((uri, j) =>
      // @ts-ignore React Native FormData file
      fd.append('photos', { uri, type: 'image/jpeg', name: `gift_${i + j}.jpg` }));
    const res = await axios.post('/gifts/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    out.push(...res.data.urls);
  }
  return out;
};

export const deliveryBy = (days: number) => {
  const d = new Date(Date.now() + days * 86400000);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};
