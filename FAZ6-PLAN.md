# Groopay — Faz 6 Planı & Tamamlananlar

> **Faz 6: Netleşme + IBAN + Push Altyapısı + WhatsApp**
> Başlangıç: 30 Mayıs 2026 · Durum: ✅ Tamamlandı (Edge Function deploy'u manuel)

---

## Kapsam

Çift taraflı netleşme (kısmi + para birimi bazında) + IBAN iste/paylaş (saklamasız) + push ALTYAPISI + WhatsApp özeti.

---

## Tamamlananlar

### Migration

| Dosya | İçerik |
|---|---|
| `supabase/migrations/0006_settlements_currency_iban.sql` | settlements: `amount_base`→`amount`+`currency`. `iban_requests` tablosu (IBAN SAKLANMAZ). 3 RPC: `add_settlement`, `confirm_settlement`, `reject_settlement`. Realtime publication. |

### Saf Fonksiyon & Test

| Dosya | Değişiklik |
|---|---|
| `lib/finance/balance.ts` | `computeBalances` settlement parametresi zaten vardı — çalışıyor |
| `lib/finance/__tests__/balance.test.ts` | 6 settlement testi eklendi (confirmed sayılır, pending/rejected sayılmaz, kısmi birikir, tam sıfırlar, çoklu para birimi ayrı, EUR settlement TRY'yi etkilemez) |

**Test: 75/75 geçiyor**

### Settlement UI

| Özellik | Durum |
|---|---|
| Sadeleştirilmiş listede "Ödedim" butonu (borçlu) | ✅ |
| Settlement modal (tutar girişi, max kontrolü) | ✅ |
| Pending kartı (onay bekleyenler) | ✅ |
| Onayla / Reddet butonları (alacaklı) | ✅ |
| Onay → bakiye güncellenir | ✅ |
| Red → bakiye değişmez | ✅ |
| Kısmi ödeme (≤ borç) | ✅ |

### WhatsApp Özeti

| Özellik | Durum |
|---|---|
| `generateWhatsAppSummary()` metin üretici | ✅ |
| Bakiyeler sekmesinde "WhatsApp ile Paylaş" butonu | ✅ |
| React Native Share API entegrasyonu | ✅ |

### Push Altyapısı

| Özellik | Durum |
|---|---|
| `expo-notifications` kurulu | ✅ |
| `lib/notifications/index.ts`: `registerPushToken(userId)` | ✅ |
| `setupNotificationHandler()` | ✅ |
| ⚠️ Expo Go'da push token ALINAMAZ — dev build (Faz 8) gerekir | ⚠️ |

### Diğer

| Özellik | Durum |
|---|---|
| `SettlementRow` tip güncellemesi (amount+currency) | ✅ |
| `IbanRequestRow` tipi (iban alanı YOK) | ✅ |
| Settlement queries (add/confirm/reject/get) | ✅ |
| `useSettlements` hook'ları | ✅ |
| `useBalance` hook settlement parametresi | ✅ |
| i18n: `settle.*` (13 anahtar tr+en), `iban.*` (16 anahtar tr+en) | ✅ |
| Realtime: settlements + iban_requests tablosu publication'da | ✅ |

### IBAN UI (bu oturumda eklendi)

| Özellik | Durum |
|---|---|
| "IBAN İste" butonu (sadeleştirilmiş listede, borçlu için) | ✅ |
| IBAN istek onay modal'ı (borçlu → alacaklıya) | ✅ |
| IBAN girme input'u + "Paylaş" butonu (alacaklı) | ✅ |
| IBAN Realtime broadcast ile anlık iletim (TABLOYA YAZMAZ) | ✅ |
| IBAN alındı modal'ı (borçluya gösterim, selectable text) | ✅ |
| "IBAN saklanmaz" bilgilendirme metni (kalkan ikonlu) | ✅ |
| Pending IBAN istekleri kartı (alacaklı tarafında) | ✅ |
| `useRealtime` hook → iban_requests dinlemesi eklendi | ✅ |

### Push Edge Function + Manuel Hatırlatma (bu oturumda eklendi)

| Özellik | Durum |
|---|---|
| `supabase/functions/send-push/index.ts` — Expo Push API HTTP isteği | ✅ |
| Client-side: `sendPushToUser()`, `remindDebtor()` helper'ları | ✅ |
| "Hatırlat" butonu (founder, sadeleştirilmiş listede) | ✅ |
| WhatsApp paylaşımı fallback (push çalışmadığında) | ✅ |

---

## Kalanlar (sonraki oturuma) ✅

### IBAN UI (modal + realtime) ✅
- [x] IBAN istek butonu (borçlu → alacaklıya)
- [x] IBAN istek modal'ı
- [x] Alacaklı tarafında: IBAN girme input'u + "Paylaş" butonu
- [x] IBAN'ı Supabase Realtime channel ile anlık ilet (tabloya YAZMADAN)
- [x] Borçlu tarafında: gelen IBAN'ı göster
- [x] "IBAN saklanmaz" bilgilendirme metni

### Push Edge Function'ları ✅
- [x] `supabase/functions/send-push/` — Expo Push API'ye HTTP isteği
- [x] Client-side helper: `sendPushToUser()`, `remindDebtor()`
- [x] Tetikleyiciler: yeni masraf, ödeme bildirildi, ödeme onaylandı/reddedildi, IBAN isteği, gruba katılım
- [x] Manuel hatırlatma (founder → borçluya push — WhatsApp fallback)
- [ ] ~~Deploy: Supabase Dashboard → Edge Functions~~ (manuel, Faz 8 öncesi yapılır)

### Manuel hatırlatma ✅
- [x] Borçluya "Hatırlat" butonu (founder/alacaklı — sadeleştirilmiş listede)
- [x] WhatsApp paylaşımı fallback (Expo Go'da push çalışmadığı için)
- [x] Push gönderimi altyapısı (dev build'de aktif olur)

---

## Test Planı (yapıldı)

1. ✅ Cihaz A (borçlu): Bakiyeler → Sadeleştirilmiş → "Ödedim" → tutar gir → pending oluşur
2. ✅ Cihaz B (alacaklı): "Onay Bekleyen" kartı → "Onayla"
3. ✅ Cihaz A: Bakiye güncellenir, borç azalır
4. ✅ Cihaz B: "Reddet" derse bakiye değişmez
5. ✅ WhatsApp paylaş butonu çalışır

---

## Sonraki Faz: Faz 7 — Monetizasyon (RevenueCat)

RevenueCat kurulumu, User Pro + Group Pro entitlement, paywall ekranı, "masrafı gruba böl", restore purchases. Dev build (EAS) gerektirir.
