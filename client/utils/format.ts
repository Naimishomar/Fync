/** 999 → "999", 1200 → "1.2K", 3400000 → "3.4M". One format across the app. */
export const formatCount = (n: number | null | undefined): string => {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  if (v < 1000) return String(v);
  const [div, unit] = v < 1e6 ? [1e3, 'K'] : v < 1e9 ? [1e6, 'M'] : [1e9, 'B'];
  const x = v / div;
  // One decimal under 10 (1.2K), none above (12K); never "1.0K".
  const s = x < 10 ? (Math.floor(x * 10) / 10).toFixed(1).replace(/\.0$/, '') : String(Math.floor(x));
  return s + unit;
};
