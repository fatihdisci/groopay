# Groopay — Faz 7 Planı: Monetizasyon (RevenueCat + Paywall + Pro Kapıları)

> **Durum:** ✅ Tamamlandı (2026-05-30)
> **Sonraki:** Faz 8 — Store-hazırlık + cila + OAuth + dev build
> **Bağlam:** `docs/groopay-scope.md` Monetizasyon bölümü, `docs/groopay-build-spec.md` Bölüm 4

---

## Özet

Freemium modeli: **Grup Pro** (tek seferlik, gruba kalıcı) + **User Pro** (tüm gruplar + kişisel). RevenueCat SDK üzerinden IAP, sunucu tarafında webhook ile entitlement yazma. Native modül olduğu için Expo Go'da satın alma çalışmaz — kod dev build'de tam çalışacak şekilde yazıldı, Expo Go'da UI görünür + zarif fallback.

---

## Tamamlanan İşler

### 1. RevenueCat SDK Wrapper (`lib/revenuecat/index.ts`)

- **init:** `initRevenueCat(appUserId)` — app-user-id = Supabase `auth.uid()`. API key `Platform.select` ile iOS/Android env'den okunur. Expo Go'da `configure()` throw edince `_nativeAvailable = false` + hata mesajı loglanır, uygulama çökmez.
- **Offerings:** `getOfferings()` → `{ groupPro, userPro }` — fiyat, başlık, açıklama içeren `OfferingsResult`. RevenueCat'ten `Purchases.getOfferings()` ile çekilir, başarısızsa `null`.
- **Satın alma:** `purchaseGroupPro(offeringId, groupId)` — önce `setAttributes({ group_id })` ile metadata geçilir (webhook'un hangi grubu işaretleyeceğini bilmesi için), sonra `purchasePackage`. `purchaseUserPro(offeringId)` — standart satın alma.
- **Restore:** `restorePurchases()` — Apple zorunlu, `Purchases.restorePurchases()`.
- **Entitlement check:** `checkUserProEntitlement()`, `checkGroupProEntitlement()` — RevenueCat client-side sorgu (authoritative kaynak DB'dir, bunlar tamamlayıcı).
- **Fallback:** `isRevenueCatAvailable()` → Expo Go'da `false`, dev build'de `true`. Tüm purchase fonksiyonları `devBuildRequired: true` döner, UI "dev build gerekli" Alert'i gösterir.

### 2. RevenueCat Webhook (`supabase/functions/revenuecat-webhook/index.ts`)

- RevenueCat'ten POST alır.
- `Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>` ile auth doğrulaması.
- `INITIAL_PURCHASE`, `RENEWAL`, `NON_RENEWING_PURCHASE` olaylarını işler.
- **User Pro olayı:** `entitlement_ids` içinde `user_pro` varsa → `profiles` tablosunda `user_pro = true`, `user_pro_purchased_at` yazılır (`app_user_id` = `profiles.id` eşleşmesiyle).
- **Group Pro olayı:** `entitlement_ids` içinde `group_pro` varsa → subscriber attributes'ten `group_id` okunur → `groups` tablosunda `is_pro = true`, `pro_purchased_by`, `pro_purchased_at` yazılır. `group_id` yoksa 400 döner.
- Service-role key ile çalışır → RLS baypas, tüm tablolara yazma yetkisi.
- Idempotent: aynı olay tekrar gelirse overwrite eder (sorun değil).

### 3. Paywall Ekranı (`app/paywall.tsx`)

- Route: `/paywall?context=<type>&groupId=<id>`
- **Context'ler:**
  - `context=limit` → 5-grup limitine takılınca, User Pro vurgulu.
  - `context=group-pro&groupId=xxx` → grupta Pro özelliği denenince, Grup Pro vurgulu.
  - `context=feature&groupId=xxx` → Pro kapısından tıklanınca, Grup Pro vurgulu.
- **İçerik:**
  - Pro özellik listesi (fiş/OCR, tekrarlayan, dışa aktarma, grafikler, sınırsız grup).
  - Grup Pro kartı (sadece groupId varsa gösterilir) — tek seferlik, grup kalıcı, "Bu Grubu Pro Yap".
  - User Pro kartı — tüm gruplar + kişisel.
  - "Satın alımları geri yükle" butonu (Apple şartı).
- **Expo Go:** `isRevenueCatAvailable() === false` ise "Satın Al" butonları çalışır ama Alert ile "Bu özellik dev build'de aktif" bilgisi verilir, çökmez.
- **Zaten Pro ise:** "Zaten Pro'sunuz!" ekranı + "Tamam" butonu.
- **Offerings:** RevenueCat'ten canlı fiyat çekilir, gösterilir. Başarısızsa "Yükleniyor..." yazısı kalır.

### 4. Pro Hook (`hooks/usePro.ts`)

```ts
usePro() → {
  isUserPro: boolean;                           // profile.user_pro
  isGroupPro(group): boolean;                   // group.is_pro
  hasProAccess(group): boolean;                 // user_pro VEYA group.is_pro
}
```

- `hasProAccess` → bir grupta Pro özelliklerinin açık olup olmadığını kontrol eder. Hem User Pro (tüm gruplar) hem Grup Pro (o grup) için `true`.

### 5. 5-Grup Limiti (Free Kapısı)

- **Kontrol:** `app/(tabs)/groups.tsx` içinde `createdGroupCount` query'si: `supabase.from('groups').select('*', {count:'exact', head:true}).eq('created_by', uid).eq('is_demo', false)`.
- **Limit:** `>= 5` ve `!isUserPro` ise → FAB tıklanınca create modal YERINE `/paywall?context=limit` yönlendirmesi.
- **Demo gruplar sayılmaz:** `is_demo = false` filtresi.
- **FAB göstergesi:** Limit dolmuşsa FAB üstünde kırmızı kilit rozeti.
- User Pro olan kullanıcıda limit kontrolü yapılmaz — doğrudan create modal açılır.

### 6. Genel Bakiye Özeti (ÜCRETSIZ)

- **Konum:** Gruplar sekmesinin EN ÜSTÜNDE, `ListHeaderComponent` olarak.
- **Hesaplama:** Tüm gruplardaki expenses + splits + confirmed settlements → `computeBalances()` → kullanıcının member ID'lerine filtre → `groupByCurrency()` → her para birimi için toplam netMinor.
- **Gösterim:** Para birimi bazında, yeşil (alacak) / kırmızı (borç), çevirme YOK. Örn: `+525,00 ₺  −50,00 €  +200,00 $`.
- **Boş durum:** Hiç bakiye yoksa bileşen render edilmez (null).
- Herkese açık, paywall yok.

### 7. Dashboard Ekranı (USER PRO)

- Route: `/dashboard` (Stack ekran, tab değil).
- **Free kullanıcı:** Kilit ekranı → "Dashboard Pro'ya Özel" + "Pro'ya Geç" butonu → paywall.
- **User Pro içerik:**
  - **Genel Bakiye:** Her para birimi için kart (currency, +/- tutar, alacak/borç etiketi).
  - **Kategori Dağılımı:** Kullanıcının tüm gruplardaki payları, kategoriye göre toplanmış.
  - **Trendler:** Placeholder ("Yakında").
- **ÖNEMLİ:** Tek bir "toplam net varlık" rakamı GÖSTERİLMEZ. Her para birimi ayrı kart. Çevirme YOK.

### 8. Pro Kapıları (UI)

- **`components/ProGate.tsx`:**
  - `ProGate` — children'ı Pro erişimi varsa render eder, yoksa kilitli placeholder + "Pro'ya Geç" butonu.
  - `ProBadge` — küçük "Pro" rozeti.
  - `ProFeatureRow` — menü/liste öğesi. Pro varsa normal tıklanabilir, yoksa kilit ikonu + badge + tıklanınca paywall.
- **Grup detay sayfası (`app/groups/[id]/index.tsx`):** Masraf sekmesinde, filtrelerin üstünde Pro özellik satırları:
  - Fiş/OCR (receipt-outline)
  - Tekrarlayan masraf (repeat-outline)
  - Dışa aktarma (download-outline)
  - Gelişmiş grafikler (stats-chart-outline)
- Her satır, `group.is_pro || user_pro` değilse kilitli gösterilir, tıklanınca `/paywall?context=feature&groupId=xxx` açar.

### 9. Hesap Ekranı Pro Bölümü (`app/(tabs)/account.tsx`)

- **Pro durum kartı:**
  - User Pro ise → yeşil "Pro Üye" kartı, "Pro üyeliğiniz aktif" açıklaması.
  - Free ise → "Ücretsiz" kartı, "5 grup oluşturabilirsiniz" + "Pro'ya Geç" butonu.
- **Dashboard linki:** "Dashboard" menü öğesi → `/dashboard`. Free kullanıcıda kilit ikonu.
- **Restore butonu:** "Satın alımları geri yükle" menü öğesi → `restorePurchases()` → Alert sonuç.
- **Pro rozeti:** Avatar'ın altında, User Pro kullanıcıda "Pro Üye" elmas rozeti.

### 10. i18n

| Namespace | Yeni Anahtar Sayısı | Kapsam |
|---|---|---|
| `paywall.*` | 22 | Başlık, alt başlık, özellik listesi, satın alma butonları, hata/başarı mesajları, restore, dev build notice |
| `pro.*` | 5 | Kilit mesajları, rozet, upgrade butonu |
| `dashboard.*` | 10 | Başlık, bakiye, kategori, trend, kilit ekranı |
| `account.*` | 10 yeni | Pro durumu, restore, dashboard linki, free/pro açıklamaları |
| `balance.*` | 2 yeni | overallSummary, overallEmpty |

Tüm anahtarlar hem `tr.json` hem `en.json` dosyasında mevcut.

---

## Değişen Mevcut Dosyalar

| Dosya | Değişiklik |
|---|---|
| `app/_layout.tsx` | `RevenueCatInit` bileşeni (auth sonrası `initRevenueCat` çağrısı), paywall/dashboard Stack.Screen kayıtları |
| `app/(tabs)/groups.tsx` | 5-grup limit kontrolü, genel bakiye özeti `OverallBalanceSummary`, FAB limit rozeti, grup Pro rozeti |
| `app/(tabs)/account.tsx` | Pro durum kartı, Dashboard linki, Restore butonu, User Pro rozeti |
| `app/groups/[id]/index.tsx` | Pro özellik kapıları (ProFeatureRow x4), ProBadge import |
| `lib/auth/types.ts` | `Profile` interface → `user_pro`, `user_pro_purchased_at` eklendi |
| `lib/auth/AuthContext.tsx` | `profileRowToProfile` → `user_pro` alanları taşınıyor |
| `locales/tr.json` | `paywall`, `pro`, `dashboard` namespace'leri eklendi; `account` ve `balance` genişletildi |
| `locales/en.json` | Aynı anahtarlar İngilizce |
| `app.json` | `react-native-purchases` Expo plugin eklendi |
| `package.json` | `react-native-purchases` bağımlılığı |
| `.env.example` | `EXPO_PUBLIC_REVENUECAT_APPLE_KEY`, `EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY` placeholder |

---

## Veritabanı

**Yeni migration YOK.** Faz 2 şemasında (`0001_initial_schema.sql`) zaten var olan alanlar:

```
profiles:
  user_pro              boolean NOT NULL DEFAULT false
  user_pro_purchased_at timestamptz

groups:
  is_pro                boolean NOT NULL DEFAULT false
  pro_purchased_by      uuid REFERENCES profiles(id)
  pro_purchased_at      timestamptz
```

---

## RevenueCat Webhook — Deploy Adımları (Faz 8'de yapılacak)

```bash
# 1. Supabase Dashboard → Project Settings → API → service_role key'i kopyala
# 2. Secret oluştur (rastgele 32+ karakter):
#    supabase secrets set REVENUECAT_WEBHOOK_SECRET=<rastgele-deger>
# 3. Deploy:
supabase functions deploy revenuecat-webhook
# 4. Fonksiyon URL'ini al:
#    https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook
```

**RevenueCat Dashboard ayarları:**
1. **Integrations → Webhooks:** Yeni webhook ekle
   - URL: `https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook`
   - Authorization Header: `Bearer <REVENUECAT_WEBHOOK_SECRET>`
   - Events: `INITIAL_PURCHASE`, `RENEWAL`, `NON_RENEWING_PURCHASE`
2. **Entitlements:**
   - `user_pro` → User Pro ürün(ler)ine bağla
   - `group_pro` → Group Pro ürün(ler)ine bağla
3. **Offerings → default:**
   - Group Pro: tek seferlik (NON_RENEWING_PURCHASE veya CONSUMABLE), identifier: `group_pro`
   - User Pro: yıllık/yenilenen, identifier: `user_pro`

---

## Faz 8 Test Listesi

### RevenueCat + IAP

- [ ] `.env` dosyasına gerçek RevenueCat API key'leri girildi
- [ ] App Store Connect'te ürünler oluşturuldu (Group Pro + User Pro)
- [ ] Google Play Console'da ürünler oluşturuldu
- [ ] RevenueCat Dashboard'da ürünler bağlandı, offerings yapılandırıldı
- [ ] RevenueCat webhook deploy edildi, secret ayarlandı
- [ ] EAS dev build alındı (`eas build --profile development --platform ios`)
- [ ] Sandbox: Grup Pro satın alma → webhook `groups.is_pro = true` yazdı mı?
- [ ] Sandbox: User Pro satın alma → webhook `profiles.user_pro = true` yazdı mı?
- [ ] Restore purchases çalışıyor mu?
- [ ] Satın alma sonrası Pro kapıları açılıyor mu?
- [ ] Paywall'da RevenueCat'ten canlı fiyat geliyor mu?
- [ ] 5-grup limiti User Pro olunca kalkıyor mu?
- [ ] "Masrafı gruba böl" akışı manuel test edildi mi?

### Expo Go'da

- [ ] Paywall ekranı açılıyor, "dev build gerekli" Alert'i gösteriyor, çökme yok
- [ ] Genel bakiye özeti Gruplar üstünde görünüyor (para birimi bazında, çevirme yok)
- [ ] 6. grubu oluşturmaya çalışınca paywall çıkıyor
- [ ] Demo grup limit sayımına dahil değil
- [ ] Pro kapıları (kilit rozetleri) grup detayda görünüyor, tıklanınca paywall
- [ ] Dashboard free kullanıcıya kilitli
- [ ] Hesap ekranında Pro durumu "Ücretsiz" gösteriyor

---

## Mimari Diyagram

```
┌─────────────────────────────────────────────────┐
│ CLIENT (React Native / Expo)                     │
│                                                  │
│  _layout.tsx                                     │
│    └─ RevenueCatInit → initRevenueCat(uid)       │
│                                                  │
│  app/paywall.tsx                                 │
│    ├─ getOfferings() → fiyat göster              │
│    ├─ purchaseGroupPro(id, groupId)              │
│    │    └─ setAttributes({group_id}) + purchase  │
│    ├─ purchaseUserPro(id)                        │
│    └─ restorePurchases()                         │
│                                                  │
│  hooks/usePro.ts                                 │
│    └─ isUserPro || group.is_pro → hasProAccess   │
│                                                  │
│  components/ProGate.tsx                          │
│    ├─ ProGate (children veya kilit)              │
│    ├─ ProBadge (rozet)                           │
│    └─ ProFeatureRow (menü öğesi)                 │
│                                                  │
│  app/(tabs)/groups.tsx                           │
│    ├─ OverallBalanceSummary (ÜCRETSİZ)           │
│    └─ 5-grup limit kontrolü → paywall            │
│                                                  │
│  app/dashboard.tsx (USER PRO)                    │
│    └─ Tüm gruplar bakiye + kategori + trend      │
└──────────────────┬──────────────────────────────┘
                   │
    ┌──────────────▼──────────────┐
    │ RevenueCat SDK              │
    │  (StoreKit / Billing)       │
    └──────────────┬──────────────┘
                   │ webhook
    ┌──────────────▼──────────────┐
    │ Supabase Edge Function      │
    │  revenuecat-webhook         │
    │  ├─ Auth: Bearer token      │
    │  ├─ user_pro → profiles     │
    │  └─ group_pro → groups      │
    └──────────────┬──────────────┘
                   │
    ┌──────────────▼──────────────┐
    │ Supabase Postgres           │
    │  profiles.user_pro          │
    │  groups.is_pro              │
    │  groups.pro_purchased_by    │
    │  groups.pro_purchased_at    │
    └─────────────────────────────┘
```

---

## Önemli Tasarım Kararları

1. **Expo Go fallback:** Native modül yokluğunda çökme olmaz. `isRevenueCatAvailable()` kontrolü ile tüm satın alma fonksiyonları `devBuildRequired: true` döner, UI bunu Alert ile gösterir.
2. **Entitlement çift kaynak:** Client'ta RevenueCat (`getCustomerInfo`) + DB (`profiles.user_pro` / `groups.is_pro`). Authoritative kaynak DB'dir (webhook yazar), RevenueCat client-side tamamlayıcıdır.
3. **Group Pro metadata:** `purchaseGroupPro` önce `setAttributes({group_id})` çağırır, sonra satın alır. Webhook bu attribute'u okur. Bu sayede entitlement gruba bağlanır, satın alanın hesabına değil.
4. **Pro erişim mantığı:** `group.is_pro OR profile.user_pro`. User Pro tüm gruplarda Pro açar; Grup Pro sadece o grupta.
5. **Para birimi:** Genel bakiye özeti ve dashboard'da para birimleri ASLA toplanmaz, ASLA çevrilmez. Her biri ayrı gösterilir.
6. **Migration gerekmedi:** Faz 2 şeması monetizasyon alanlarını zaten içeriyordu.
7. **Pro özellik içerikleri sonraki fazlarda:** Fiş/OCR, tekrarlayan masraf, dışa aktarma, grafiklerin gerçek implementasyonu yok — sadece kapılar ve kilitler var.

---

*Son güncelleme: 2026-05-30 — Faz 7 tamamlandı*
