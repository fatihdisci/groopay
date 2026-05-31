# Groopay — Faz 4 Planı & Tamamlananlar

> **Faz 4: Masraf CRUD + Bölüşme + Çoklu Para Birimi**
> Başlangıç: 30 Mayıs 2026 · Tamamlandı: 30 Mayıs 2026

---

## Karar Değişikliği (Faz 4 öncesi)

Eski model: Masraf girildiği anda kur sabitlenir (`fx_rate_to_base`, `amount_in_base`), bakiye bu sabit değerden hesaplanır.

**Yeni model (Türkiye'nin yüksek kur oynaklığı sebebiyle):**
- Masraf hangi para biriminde girildiyse **orijinal haliyle** saklanır (`amount` + `currency`). Asla TRY'ye çevrilip kaydedilmez.
- Bakiye/borç hesabı her zaman **orijinal para biriminde** yapılır. Farklı para birimleri **ayrı** gösterilir.
- Çevrim **sadece görüntüleme** için: kullanıcı isterse canlı kurla `≈ X TRY` gösterilir, bu değer **hiçbir yere kaydedilmez**.
- Grup `base_currency` artık sadece **varsayılan görüntüleme para birimi** (hesap temeli değil).
- Migration: `fx_rate_to_base`, `amount_in_base`, `share_amount_base` sütunları **DROP** edildi.

---

## Döküman Güncellemeleri

| Dosya | Değişiklik |
|---|---|
| `CLAUDE.md` | FX bölümü: "kur girişte kilitlenir" → "orijinal saklama + canlı gösterim". Financial Logic: para birimi bazında bakiye. |
| `docs/groopay-scope.md` | Temel Prensipler + Çoklu Para Birimi (5 madde) yeni modele göre yazıldı. |
| `docs/groopay-build-spec.md` | SQL'den `fx_rate_to_base`/`amount_in_base`/`share_amount_base` kaldırıldı. Bölüm 2.2 → canlı görüntüleme. Bölüm 2.3-2.4 → para birimi bazında. Faz 4 kabul kriteri güncellendi. |

---

## Yeni Dosyalar

### Saf Hesaplama (`lib/finance/`)

| Dosya | İçerik |
|---|---|
| `money.ts` | `toMinor`/`fromMinor`/`getDecimals` — kuruş hesaplama. 20 para birimi desteği. JPY/KRW 0 ondalık, BHD/KWD 3 ondalık. `SUPPORTED_CURRENCIES` dizisi (sembol, etiket, bayrak). |
| `split.ts` | `splitEqual` — eşit bölüşme, kalan kuruş ödeyene. `splitCustomAmounts` — kişi başı tutar, toplam ≠ total → hata. `splitCustomShares` — pay oranına göre, kalan en büyük paya. `splitSubset` — sadece seçili üyelere eşit bölüşme. Tüm fonksiyonlarda **toplam = total garantisi** (kuruş kaçağı yok). |
| `fx.ts` | `fetchRate(from, to)` — Frankfurter API (ücretsiz, key yok). `from===to` → 1. Hata → `null` (sessiz). **Sadece görüntüleme, kaydedilmez.** |
| `categories.ts` | 6 kategori: Yemek&Market, Ulaşım, Kira&Fatura, Eğlence, Seyahat, Diğer. İkon ve renk eşlemesi. |
| `index.ts` | Barrel export. |

### Testler (`lib/finance/__tests__/`)

| Dosya | Test Sayısı | Kapsam |
|---|---|---|
| `money.test.ts` | 18 | `getDecimals` (TRY 2, JPY 0, BHD 3, bilinmeyen→2), `toMinor`/`fromMinor` roundtrip, floating-point edge case |
| `split.test.ts` | 31 | 100/3 bölüşme, 0.01/2, 10/4 eşit, custom toplam≠total hatası, pay 1:2:1, alt-küme, JPY, tek üye, negatif tutar hatası, boş liste hatası |

**Toplam: 49 test, hepsi geçiyor.** Test runner: `vitest`.

### Test Çıktısı
```
Test Files  2 passed (2)
     Tests  49 passed (49)
  Duration  ~1.1s
```

### Hook'lar

| Dosya | İçerik |
|---|---|
| `hooks/useExpenses.ts` | `useExpenses(groupId, filters)` — liste + filtre. `useAddExpense` — RPC ile atomik ekleme. `useUpdateExpense` — split'lerle birlikte güncelleme. `useDeleteExpense` — soft delete. `canModifyExpense` — yetki kontrolü (sahip/founder). `getActorMember` — giriş yapan kullanıcının üye satırı. |
| `hooks/useFxRate.ts` | `useFxRate(from, to)` — React Query, 1 saat cache. `formatFxDisplay` — `≈ 2.100 TRY` formatında gösterim. Hata → `null` (sessiz). |

### Supabase

| Dosya | İçerik |
|---|---|
| `supabase/migrations/0004_drop_fx_columns_add_expense_rpc.sql` | **Part 1:** `expenses.fx_rate_to_base`, `expenses.amount_in_base`, `expense_splits.share_amount_base` → DROP COLUMN. **Part 2:** `add_expense_with_splits` RPC — masraf + split'ler tek transaction'da atomik eklenir, orijinal para biriminde. Aktivite logu otomatik yazılır. |

### UI

| Dosya | İçerik |
|---|---|
| `app/groups/[id]/add-expense.tsx` | Masraf ekleme/düzenleme formu. **Add modu:** boş form. **Edit modu:** `expenseId` ile mevcut veri doldurulur. Açıklama, tutar (büyük input, virgül→nokta normalizasyonu), para birimi seçici (TRY/USD/EUR + Diğer expandable), opsiyonel canlı FX gösterimi, kategori (6 chip), ödeyen seçici, bölüşme tipi (eşit/özel/alt-küme), canlı önizleme, not, kaydet butonu. |

---

## Değişen Dosyalar

| Dosya | Değişiklik |
|---|---|
| `lib/supabase/types.ts` | `ExpenseRow`: `fx_rate_to_base`/`amount_in_base` kaldırıldı. `ExpenseSplitRow`: `share_amount_base` kaldırıldı. Yeni: `ExpenseWithSplits`, `AddExpenseInput`, `ExpenseFilters`. |
| `lib/supabase/queries.ts` | `createDemoGroup` — eski FX sütunları kaldırıldı, kuruş bölme eklendi. Yeni: `addExpense`(RPC), `updateExpenseWithSplits` (expense + split güncelleme), `deleteExpense`(soft), `getExpenses`(filtreli). Yeni: `canModifyExpense`. |
| `app/groups/[id]/index.tsx` | Gerçek masraf listesi: **büyük açıklama metni** (16px bold), kategori ikonu, ödeyen · tarih, orijinal tutar, opsiyonel FX, **split özeti (isim + tutar)** her chip'te, düzenle/sil butonları (sadece sahip/founder görür), kategori filtresi, FX toggle. |
| `app/groups/[id]/add-expense.tsx` | Masraf ekleme/düzenleme formu. Add modu: boş form. **Edit modu:** `expenseId` paramıyla mevcut veri doldurulur. Virgül→nokta normalizasyonu. Para birimi TRY/USD/EUR + Diğer. Canlı bölüşme önizlemesi. |
| `app/groups/[id]/_layout.tsx` | `add-expense` screen route + dinamik title: "Masraf Ekle" / "Masrafı Düzenle" |
| `app/_layout.tsx` | `headerTintColor: '#4F46E5'` eklendi (geri butonu mor, iOS highlight düzeldi) |
| `locales/tr.json` | `expense.*` (28 anahtar), `categories.*` (6 anahtar) |
| `locales/en.json` | `expense.*`, `categories.*`, `members.*`, `groups.*`, `groupDetail` bölümleri tamamlandı |
| `package.json` | `test`/`test:watch` scripts, `vitest` devDependency |

---

## Veri Modeli (Güncel)

```sql
-- expenses (fx_rate_to_base ve amount_in_base KALDIRILDI)
expenses (
  id, group_id, description, note,
  amount numeric(14,2),      -- ORİJİNAL para biriminde
  currency text,              -- EUR/USD/TRY...
  category, split_type, paid_by, expense_date, created_by,
  created_at, updated_at, deleted_at
);

-- expense_splits (share_amount_base KALDIRILDI)
expense_splits (
  id, expense_id, member_id,
  share_amount numeric(14,2)  -- ORİJİNAL para biriminde
);

-- groups (base_currency = varsayılan GÖRÜNTÜLEME para birimi)
groups (
  ...base_currency text default 'TRY'...
);
```

---

## Kabul Kriterleri

| Kriter | Durum |
|---|---|
| `npx tsc --noEmit` temiz | ✅ |
| 49 birim testi geçiyor, kuruş kaçağı yok | ✅ |
| Migration uygulandı, eski FX sütunları kalktı | ✅ |
| Eşit bölüşme: 100/3 = 33.34+33.33+33.33, toplam=100 | ✅ |
| Özel bölüşme: toplam≠total → hata | ✅ |
| Alt-küme: 5 üyeden 3'ü seçili, diğerleri 0 | ✅ |
| Masraf orijinal para biriminde saklanıyor (TRY değeri YOK) | ✅ |
| FX sadece görüntüleme, opsiyonel toggle, kaydedilmez | ✅ |
| 50 EUR masraf → DB'de amount=50, currency=EUR | ✅ |
| TRY karşılığı istenirse canlı Frankfurter kuruyla gösterilir | ✅ |
| Soft delete: silinen masraf listeden kaybolur, DB'de kalır | ✅ |
| Düzenleme: sahip veya founder düzenleyebilir | ✅ |
| Yetki: sadece sahip/founder edit/delete butonlarını görür | ✅ |
| Türkçe klavye virgül (`,`) → nokta (`.`) dönüşümü | ✅ |
| Tutar input'u büyük, para birimi TRY/USD/EUR + Diğer | ✅ |

---

## Sonraki Faz: Faz 5 — Bakiye + Sadeleştirme + Aktivite

- Bakiye hesaplama (saf fonksiyon, para birimi bazında)
- Borç sadeleştirme (greedy min cash flow)
- Grup detay bakiyeler sekmesi
- Realtime sync
- Aktivite akışı UI
