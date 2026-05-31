// constants/avatarColors.ts
// Groopay avatar gradient system
// Base hex'ler DEĞİŞMEZ — profiles.avatar_color'da kayıtlı kullanıcı verisi var

/** Mevcut avatar renkleri — AYNI KALMALI, kullanıcıların seçtiği renkler bunlar */
export const AVATAR_COLORS = [
  '#6C5CE7', // mor
  '#00B894', // yeşil
  '#E17055', // mercan
  '#0984E3', // mavi
  '#FDCB6E', // sarı
  '#E84393', // pembe
  '#00CEC9', // teal
  '#D63031', // kırmızı
] as const;

/**
 * Her base renk için gradient çifti: [base, açık-ton].
 * Açık ton: base hex → lighter (manuel seçildi, marka hissi korunarak).
 * Gradient: 135° (sol-üst → sağ-alt).
 */
export const AVATAR_GRADIENTS: Record<string, readonly [string, string]> = {
  '#6C5CE7': ['#6C5CE7', '#A29BFE'] as const, // mor → açık mor
  '#00B894': ['#00B894', '#55EFC4'] as const, // yeşil → açık yeşil
  '#E17055': ['#E17055', '#FAB1A0'] as const, // mercan → açık mercan
  '#0984E3': ['#0984E3', '#74B9FF'] as const, // mavi → açık mavi
  '#FDCB6E': ['#FDCB6E', '#FFEAA7'] as const, // sarı → açık sarı
  '#E84393': ['#E84393', '#FD79A8'] as const, // pembe → açık pembe
  '#00CEC9': ['#00CEC9', '#81ECEC'] as const, // teal → açık teal
  '#D63031': ['#D63031', '#FF7675'] as const, // kırmızı → açık kırmızı
};

/**
 * Bir base hex için gradient döndürür.
 * Eşleşme yoksa [color, color] fallback.
 */
export function getAvatarGradient(color: string): readonly [string, string] {
  return AVATAR_GRADIENTS[color] ?? [color, color];
}

/**
 * Gradient açısı — tüm avatarlarda tutarlı.
 */
export const AVATAR_GRADIENT_ANGLE = 135;

/**
 * Hex rengi HSL uzayında koyulaştırır.
 * factor: 0–1 arası, 0 = değişiklik yok, 1 = tamamen siyah.
 * Header arka planlarında beyaz metin okunurluğu için kullanılır.
 */
export function darkenHex(hex: string, factor: number): string {
  // Hex → RGB
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  // Yeni lightness: mevcut lightness'ı factor oranında azalt
  const newL = Math.max(0, l * (1 - factor));

  if (max === min) {
    // Achromatic (gray) — sadece lightness değişir
    const v = Math.round(newL * 255);
    return `#${v.toString(16).padStart(2, '0')}${v.toString(16).padStart(2, '0')}${v.toString(16).padStart(2, '0')}`;
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  if (max === r) {
    h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  } else if (max === g) {
    h = ((b - r) / d + 2) / 6;
  } else {
    h = ((r - g) / d + 4) / 6;
  }

  // HSL → RGB (sabit hue + saturation, yeni lightness)
  function hue2rgb(p: number, q: number, t: number): number {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }

  const q2 = newL < 0.5 ? newL * (1 + s) : newL + s - newL * s;
  const p2 = 2 * newL - q2;

  const newR = Math.round(hue2rgb(p2, q2, h + 1 / 3) * 255);
  const newG = Math.round(hue2rgb(p2, q2, h) * 255);
  const newB = Math.round(hue2rgb(p2, q2, h - 1 / 3) * 255);

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

/**
 * Header gradient için [koyu-ton, base] çifti döndürür.
 * Beyaz metin her zaman okunur olur.
 */
export function getAvatarHeaderGradient(color: string): readonly [string, string] {
  return [darkenHex(color, 0.35), color] as const;
}
