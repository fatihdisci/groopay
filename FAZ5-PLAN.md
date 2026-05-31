# Groopay — Faz 5 Planı & Tamamlananlar

> **Faz 5: Bakiye + Borç Sadeleştirme + Aktivite + Realtime**
> Başlangıç: 30 Mayıs 2026 · Tamamlandı: 30 Mayıs 2026

---

## Kapsam

Bakiye hesaplama (para birimi bazında), borç sadeleştirme (greedy), bakiye sekmesi (ham + sadeleştirilmiş), aktivite akışı, Realtime canlı güncelleme.

**Dışarıda bırakılan (Faz 6):** Netleşme / "ödendi" / IBAN / push / WhatsApp.

---

## KRİTİK: Her şey para birimi bazında

EUR borçları kendi içinde, TRY borçları kendi içinde sadeleşir; asla karışmaz/toplanmaz. Bakiye ve sadeleştirme her para birimi için ayrı hesaplanır.

---

## Yeni Dosyalar

### Saf Hesaplama (`lib/finance/`)

| Dosya | İçerik |
|---|---|
| `balance.ts` | `computeBalances(expenses, splits, settlements?)` → her üye için her para biriminde net bakiye (minor unit). `net(m, cur) = ödediği − payı`. Settlement opsiyonel (Faz 6). `validateBalanceSum` → her currency için Σ = 0 kontrolü. `groupByCurrency` → Map<currency, balances[]. |
| `simplify.ts` | `simplifyDebts(nets for ONE currency)` → greedy min cash flow: en büyük alacaklı ↔ en büyük borçlu eşle, tekrarla. `simplifyByCurrency` → Map<currency, tx[]>. |

### Testler (`lib/finance/__tests__/`)

| Dosya | Test Sayısı | Kapsam |
|---|---|---|
| `balance.test.ts` | 10 | Basit (A+50 B-50), çoklu para birimi (EUR+TRY ayrı), deleted masraf hariç, 3 üyeli eşitsiz, kümülatif, sıfır net hariç, JPY 0 ondalık, net toplamı 0 |
| `simplify.test.ts` | 10 | Klasik 3 kişi, zaten dengeli, cyclic boş, tek çift, 4 kişi min tx, kuruş (0.01), büyük sayılar, toplam≠0 hatası |

**Toplam: 69 test (49 eski + 20 yeni), hepsi geçiyor.**

### Test Çıktısı
```
Test Files  4 passed (4)
     Tests  69 passed (69)
  Duration  ~2.0s
```

### Hook'lar

| Dosya | İçerik |
|---|---|
| `hooks/useRealtime.ts` | `useRealtime(groupId)` — Supabase channel: expenses, expense_splits, group_members, activity_log değişikliklerini dinler, React Query invalidate eder. `useRealtimeAllGroups(groupIds)` — global aktivite için tüm grupları dinler. Unmount'da cleanup. |
| `hooks/useBalance.ts` | `useBalance(expenses, splits)` → `Map<currency, BalanceByCurrency>` — her para birimi için raw balances + simplified txs. useMemo ile hesaplanır. |

### Supabase

| Dosya | İçerik |
|---|---|
| `supabase/migrations/0005_realtime_publication.sql` | `alter publication supabase_realtime add table expenses, expense_splits, group_members, activity_log` |

### UI

| Dosya | İçerik |
|---|---|
| `app/groups/[id]/index.tsx` | Tamamen yeniden yazıldı. **Tab bar:** Masraflar / Bakiyeler. **Bakiye sekmesi:** self-summary kart (kullanıcının kendi durumu), simplified/raw toggle, her para birimi için ayrı kart. Raw: üye listesi + net (yeşil+/kırmızı−). Simplified: "X → Y: Z TL" satırları. Realtime ile canlı güncelleme. Aktivite akışı (son 5 olay, relatif zaman). |
| `app/(tabs)/activity.tsx` | Tamamen yeniden yazıldı. Tüm gruplardan 50 olay kronolojik. Realtime ile canlı. Olay tipine göre formatlanmış metin (i18n). Relatif zaman ("5 dk önce"). |

---

## Değişen Dosyalar

| Dosya | Değişiklik |
|---|---|
| `lib/finance/index.ts` | Barrel export: balance.ts + simplify.ts eklendi |
| `locales/tr.json` | `balance.*` (8 anahtar), `activity.*` (15 anahtar), `groupDetail` temizlendi |
| `locales/en.json` | `balance.*` (8 anahtar), `activity.*` (15 anahtar) |

---

## Realtime — Kurulum Adımı

Supabase SQL Editor'de çalıştırıldı:
```sql
alter publication supabase_realtime add table expenses;
alter publication supabase_realtime add table expense_splits;
alter publication supabase_realtime add table group_members;
alter publication supabase_realtime add table activity_log;
```

RLS zaten aktif olduğu için kullanıcı sadece kendi gruplarının değişikliklerini alır.

---

## Kabul Kriterleri

| Kriter | Durum |
|---|---|
| `npx tsc --noEmit` temiz | ✅ |
| 69 birim testi geçiyor, bakiye net toplamı 0 | ✅ |
| Çoklu para birimi karışmıyor (EUR + TRY ayrı) | ✅ |
| Sadeleştirme minimum işlem | ✅ |
| Realtime migration çalıştırıldı | ✅ |
| Bakiye sekmesi: simplified/raw toggle | ✅ |
| Her para birimi ayrı bölüm | ✅ |
| Kullanıcının kendi durumu öne çıkıyor | ✅ |
| Aktivite akışı: kronolojik, i18n metin, relatif zaman | ✅ |
| Global aktivite sekmesi tüm grupları gösteriyor | ✅ |
| Alacak/borç yönü + renk + metin tutarlı (tüm ekranlar) | ✅ |
| Hook sıralaması kurallı (erken return öncesi tüm hook'lar) | ✅ |

---

## Canlıda Bulunan Hatalar & Düzeltmeler

### Hata 1: "Senin Durumun" alacak/borç kelimesi ters
- **Sorun:** `netMinor > 0` (alacaklı) için `balance.youOwe` (borçlusun) yazıyordu. Yeşil renk + "+" işareti + "borçlusun" çelişkisi.
- **Düzeltme:** `net > 0` → `balance.youAreOwed` (alacaklısın) + yeşil. `net < 0` → `balance.youOwe` (borçlusun) + kırmızı. `net == 0` → `balance.youAreEven` (ödeşiksin) + gri. ± işaretleri kaldırıldı, yönü renk + kelime veriyor.
- **Değişen:** `app/groups/[id]/index.tsx` self-summary satırları, `selfNeutral` style eklendi.

### Hata 2: React Hooks sıralama hatası
- **Sorun:** `useBalance` hook'u `if (isLoading) return ...` erken dönüşünden sonra çağrılıyordu. İlk render'da `isLoading=true` → erken return → hook atlanıyor. İkinci render'da `isLoading=false` → hook ekleniyor → "Rendered more hooks than during the previous render" hatası.
- **Düzeltme:** `useBalance` ve ilgili `useMemo` çağrıları tüm erken return'lerden önceye alındı. Her render'da aynı sayıda hook çalışıyor.
- **Değişen:** `app/groups/[id]/index.tsx` hook sıralaması.

---

## İki Kullanıcılı Test Planı

1. **Cihaz A:** Grup detay → Bakiyeler sekmesini aç
2. **Cihaz B:** Aynı gruba masraf ekle
3. **Cihaz A:** Bakiye + masraf listesi + aktivite **anında güncellenmeli** (reload gerekmeden)
4. **Cihaz B:** Masrafı sil
5. **Cihaz A:** Anında yansımalı
6. Her iki cihazda da bakiye hesaplaması aynı olmalı

---

## Sonraki Faz: Faz 6 — Netleşme + IBAN + Bildirim + WhatsApp

- Çift taraflı settle (pending → confirmed)
- IBAN iste/paylaş (anlık, saklamasız)
- Expo push token + tetikleyiciler
- WhatsApp özeti
