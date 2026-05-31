# Groopay — Oturum Özeti

> Son oturum: 2026-05-30
> Durum: Faz 0-7 tamam ✅, Faz 8'e hazır

---

## Şu an neredeyiz?

Faz 0-7 tamam. Uygulama Expo Go'da iki telefonla test edildi: grup oluşturma, masraf ekleme, bakiye hesaplama, netleşme (ödedim/onayla/reddet), IBAN iste/paylaş (Realtime broadcast, saklamasız), WhatsApp paylaş, manuel hatırlatma çalışıyor. Monetizasyon altyapısı (RevenueCat + paywall + Pro kapıları) kodlandı, Expo Go'da paywall UI'ı çalışıyor.

### Bu oturumda tamamlanan (Faz 7: Monetizasyon)

**RevenueCat SDK Wrapper (`lib/revenuecat/index.ts`):**
- `initRevenueCat(appUserId)` — API key env'den, Expo Go'da zarif fallback (çökme yok)
- `getOfferings()` → Grup Pro + User Pro fiyat bilgileri
- `purchaseGroupPro(offeringId, groupId)` — metadata'ya group_id yazar, webhook okuyabilir
- `purchaseUserPro(offeringId)` — standart satın alma
- `restorePurchases()` — Apple zorunlu geri yükleme
- `isRevenueCatAvailable()` → Expo Go'da false, dev build'de true
- Native modül yoksa `devBuildRequired: true` + Alert ile bilgilendirme

**RevenueCat Webhook (`supabase/functions/revenuecat-webhook/index.ts`):**
- RevenueCat'ten INITIAL_PURCHASE/RENEWAL olaylarını alır
- `Authorization: Bearer <secret>` ile doğrular
- `user_pro` entitlement → `profiles.user_pro = true`
- `group_pro` entitlement → subscriber attributes'ten group_id okuyup `groups.is_pro = true`
- Service-role ile RLS baypas
- Deploy: Faz 8'de yapılacak (adımlar FAZ7-PLAN.md'de)

**Paywall Ekranı (`app/paywall.tsx`):**
- Route: `/paywall?context=<limit|group-pro|feature>&groupId=<id>`
- Grup Pro + User Pro seçenekleri, fiyat RevenueCat offering'den
- Pro özellik listesi (fiş/OCR, tekrarlayan, dışa aktarma, grafikler, sınırsız grup)
- Context-aware vurgulama (limit → User Pro, feature → Grup Pro)
- Restore butonu (Apple zorunlu)
- Expo Go: UI görünür, "Satın al" → "dev build gerekli" Alert, çökme yok
- Zaten Pro ise "Zaten Pro'sunuz!" ekranı

**Pro Hook (`hooks/usePro.ts`):**
- `isUserPro` — `profile.user_pro`
- `isGroupPro(group)` — `group.is_pro`
- `hasProAccess(group)` — `user_pro VEYA group.is_pro`

**Pro Kapıları (`components/ProGate.tsx`):**
- `ProGate` — Pro erişimi varsa children, yoksa kilitli placeholder
- `ProBadge` — küçük "Pro" rozeti
- `ProFeatureRow` — menü öğesi, kilitliyse paywall'a yönlendirir

**5-Grup Limiti (Free kapısı):**
- Grup oluşturmadan önce `count(created_by=uid, is_demo=false) >= 5` kontrolü
- Limit aşımı → `/paywall?context=limit`
- Demo gruplar sayıma DAHİL DEĞİL
- FAB üstünde kilit rozeti (limit dolunca)
- User Pro olan kullanıcıda limit kontrolü YOK

**Genel Bakiye Özeti (ÜCRETSİZ, gruplar sekmesi üstünde):**
- Tüm gruplardaki net bakiye, para birimi bazında
- Her para birimi ayrı satır: `[birim] [tutar] [borçlusun/alacaklısın]`
- Eksi işareti YOK, tutar her zaman pozitif (mutlak değer)
- Renk + kelime: yeşil "alacaklısın", kırmızı "borçlusun"
- Çevirme YOK, para birimleri toplanmaz

**Dashboard (`app/dashboard.tsx`):**
- User Pro'ya özel, free kullanıcıya kilit ekranı + "Pro'ya Geç"
- Tüm gruplar para birimi bazında bakiye kartları
- Kategori dağılımı (kullanıcının tüm gruplardaki payları)
- Trend placeholder ("Yakında")
- Tek toplam net varlık GÖSTERİLMEZ (para birimleri ayrı)

**Hesap Pro Bölümü (`app/(tabs)/account.tsx`):**
- Pro durum kartı (aktif Pro → yeşil, Free → "Pro'ya Geç" butonu)
- Dashboard linki (free'de kilit ikonu)
- "Satın alımları geri yükle" butonu
- User Pro rozeti avatar altında

**Aktivite Ekranı Düzeltmeleri (`app/(tabs)/activity.tsx`):**
- Üye isimleri ve grup isimleri artık gösteriliyor (member/group lookup map'leri)
- Her aktivite satırında grup adı rozeti
- Aktiviteler tarihe göre gruplanmış

**i18n:**
- `paywall.*` — 22 anahtar (tr + en)
- `pro.*` — 5 anahtar
- `dashboard.*` — 10 anahtar
- `account.*` — 10 yeni anahtar
- `balance.*` — 5 yeni anahtar (overallSummary, overallEmpty, overallDebt, overallCredit, overallMixed)

**Diğer:**
- `app.json` — `react-native-purchases` plugin KALDIRILDI (pakette config plugin yok, native modül otomatik linklenir)
- `package.json` — `react-native-purchases` eklendi
- `.env.example` — `EXPO_PUBLIC_REVENUECAT_APPLE_KEY`, `EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY` placeholder
- `lib/auth/types.ts` — `Profile` interface'ine `user_pro`, `user_pro_purchased_at` eklendi
- `lib/auth/AuthContext.tsx` — `profileRowToProfile` user_pro alanlarını taşıyor
- `app/_layout.tsx` — `RevenueCatInit` bileşeni, paywall/dashboard route'ları
- `app/groups/[id]/index.tsx` — Pro özellik kapıları (4 adet ProFeatureRow)

## Faz Faz Durum

| Faz | Ne | Durum |
|---|---|---|
| 0 | Proje iskeleti, Expo SDK 54, i18n, theme | ✅ |
| 1A | Anonim auth (Supabase), profil, onboarding, demo grup | ✅ |
| 2 | Veritabanı şeması (8 tablo), RLS, migration | ✅ |
| 3 | Grup CRUD, hayalet üye, davet kodu, katılma + claim | ✅ |
| 4 | Masraf CRUD + bölüşme + çoklu para birimi | ✅ |
| 5 | Bakiye + sadeleştirme + aktivite + Realtime | ✅ |
| 6 | Netleşme + IBAN + push altyapısı + WhatsApp | ✅ |
| 7 | Monetizasyon (RevenueCat + paywall + Pro kapıları) | ✅ |
| 8 | Store-hazırlık + cila + OAuth + dev build | ⏳ |

## Faz 7 Önemli Mimari Eklemeler

### RevenueCat mimarisi
```
Client (lib/revenuecat/index.ts)
  ├── initRevenueCat(uid)          ← _layout.tsx, oturum açılınca
  ├── getOfferings()               → fiyatları RevenueCat'ten çeker
  ├── purchaseGroupPro(id, gid)    → setAttributes({group_id}) + purchasePackage
  ├── purchaseUserPro(id)          → purchasePackage
  └── restorePurchases()           → Apple zorunlu

Webhook (supabase/functions/revenuecat-webhook)
  ├── user_pro olayı  → profiles.user_pro = true
  └── group_pro olayı → groups.is_pro = true (attributes'tan group_id)

Pro kontrol zinciri (client)
  profile.user_pro ─┬─→ usePro().hasProAccess(group)
  group.is_pro ─────┘       ↓
                    ProGate / ProFeatureRow / paywall
```

### Pro erişim mantığı
- `group.is_pro OR profile.user_pro` → Pro özellikleri açık
- Group Pro = tek seferlik, gruba kalıcı, herkes faydalanır
- User Pro = tüm gruplarda Pro + sınırsız grup + kişisel dashboard
- Entitlement sunucuda (`groups.is_pro` / `profiles.user_pro`), client'ta değil

### 5-grup limiti
- `count(groups where created_by=uid, is_demo=false) >= 5 && !user_pro` → paywall
- Demo grup sayılmaz

### Para birimi (değişmedi, pekiştirildi)
- Genel bakiye özeti ve dashboard'da para birimleri ASLA toplanmaz, ASLA çevrilmez
- Her para birimi ayrı satır/kart

## Çalıştırılan SQL Migration'lar

1. `0001_initial_schema.sql` — Tüm tablolar (profiles.user_pro, groups.is_pro zaten var), RLS, trigger
2. `0002_invite_preview_rpc.sql` — preview_invite RPC
3. `0003_ghost_preview_rpc.sql` — preview_ghosts RPC
4. `0004_drop_fx_columns_add_expense_rpc.sql` — FX sütunları DROP + add_expense_with_splits RPC
5. `0005_realtime_publication.sql` — Realtime publication
6. `0006_settlements_currency_iban.sql` — Settlement para birimi + IBAN requests + 3 RPC

**Faz 7: Yeni migration YOK.** `profiles.user_pro` ve `groups.is_pro` alanları Faz 2'de zaten tanımlı.

## Supabase Ayarları

- **Allow Anonymous Sign-ins:** AÇIK
- **Edge Function (deploy edildi):** `join-via-invite`
- **Edge Function (yazıldı, deploy bekliyor):** `send-push`, `revenuecat-webhook` (Faz 8)
- **Realtime:** Tüm tablolar + IBAN requests dinlemesi + broadcast channel aktif

## Bağlantı Bilgileri (.env)

```
EXPO_PUBLIC_SUPABASE_URL=https://dtlnujqtwlncwrxunihj.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_IZ_BD5POMsUMhOV7q2gZSw_Pi2qBAT6
EXPO_PUBLIC_REVENUECAT_APPLE_KEY=  (Faz 8'de doldurulacak)
EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY= (Faz 8'de doldurulacak)
```

## Başlatma Komutu

```powershell
cd C:\Users\fatih\groopay
npx expo start --tunnel --clear
```

## Önemli Mimari Kararlar (güncel)

1. **Auth:** `lib/auth/AuthContext.tsx` — `useAuth()` hook'u. Anonim auth aktif. Profile artık `user_pro` içeriyor.
2. **Hayalet üye:** `group_members.user_id = NULL`. Claim → aynı satıra `user_id` yazılır.
3. **Para:** ASLA float, integer kuruş + Postgres numeric.
4. **FX:** Masraf orijinal para biriminde saklanır. Çevrim sadece görüntüleme (canlı kur, kaydedilmez).
5. **Bakiye:** Türetilmiş (saklanmaz), expenses + splits + confirmed settlements'tan PARA BİRİMİ BAZINDA hesaplanır.
6. **RLS:** `is_member_of(gid)` SECURITY DEFINER — recursion'ı önler.
7. **Route:** `groups/[id]` tabs DIŞINDA (`app/groups/[id]/`) — tab bar'da görünmez. Paywall ve Dashboard stack ekran.
8. **Realtime:** Supabase channel ile canlı güncelleme (masraf ekle/sil, bakiye, aktivite).
9. **IBAN:** HİÇBİR TABLODA KALICI SAKLANMAZ. Realtime broadcast channel ile anlık iletilir.
10. **Push:** Expo Go'da push ÇALIŞMAZ. Altyapı hazır. Dev build (Faz 8) bekleniyor.
11. **Monetizasyon:** RevenueCat SDK (client) + webhook (sunucu). Expo Go'da IAP çalışmaz — zarif fallback, çökme yok. Dev build'de tam IAP.
12. **Pro entitlement:** Sunucuda (`groups.is_pro` / `profiles.user_pro`), client'ta değil. Webhook yazar.
13. **Grup limiti:** 5 grup (demo hariç), User Pro ile sınırsız.

## Çözülen Bug'lar

| Bug | Çözüm |
|---|---|
| SDK 56 Expo Go'da çalışmıyor | SDK 54'e düşürüldü |
| RLS recursion | `is_member_of` SECURITY DEFINER |
| Geri butonu siyahlaşıyor | `headerTintColor: '#4F46E5'` |
| Tutar 50050050 hatası | Virgül→nokta normalizasyonu (`parseNumericInput`) |
| React hooks sıralama hatası | `useBalance` erken return öncesine alındı |
| Alacak/borç kelimesi ters | `net>0` → `youAreOwed`, `net<0` → `youOwe` |
| İki telefonda aynı bakiye | `getActorMember` artık `userId` ile eşleşiyor |
| Web build hatası | AsyncStorage web'de çalışmaz → sadece iOS/Android |
| Rules of Hooks: useAuth conditional sonrası | `useAuth()` component tepesine taşındı |
| Ngrok tunnel bağlantı hatası | Geçici — `--tunnel` olmadan LAN modunda başlat |
| Aktivite ekranında isimler boş | member/group lookup map'leri eklendi, grup rozeti gösteriliyor |
| react-native-purchases config plugin hatası | Plugin app.json'dan kaldırıldı (pakette yok, native otomatik link) |

## Proje Yapısı (güncel — Faz 7 sonrası)

```
C:\Users\fatih\groopay\
  app/
    _layout.tsx                # Root: QueryClient + AuthProvider + RevenueCatInit + Stack
    index.tsx                  # Auth gate
    paywall.tsx                # Pro satın alma ekranı (Faz 7)
    dashboard.tsx              # User Pro dashboard (Faz 7)
    (auth)/                    # Giriş
    (onboarding)/              # Onboarding turu
    (tabs)/                    # Ana sekmeler (groups, activity, account)
    groups/[id]/               # Grup detay + üyeler + add-expense + IBAN modalları (Pro kapıları eklendi)
    join/                      # Kodla katılma + deep link
  lib/
    auth/                      # AuthProvider + useAuth (Profile user_pro içerir)
    supabase/                  # client, types, queries
    finance/                   # money, split, fx, balance, simplify, categories + tests (75/75)
    i18n/
    notifications/             # registerPushToken, sendPushToUser, remindDebtor
    revenuecat/                # RevenueCat SDK wrapper (Faz 7)
  hooks/                       # useGroups, useGroupDetail, useExpenses, useBalance, useFxRate, useSettlements, useRealtime, usePro
  components/                  # ProGate (Faz 7)
  constants/theme.ts           # Design token'ları
  locales/ tr.json en.json     # i18n (paywall.*, pro.*, dashboard.* eklendi)
  supabase/
    migrations/                # 0001 - 0006 (Faz 7: yeni migration yok)
    functions/
      join-via-invite/         # Faz 3: davetle katılım
      send-push/               # Faz 6: Expo Push API
      revenuecat-webhook/      # Faz 7: RevenueCat → DB entitlement
  docs/                        # groopay-scope.md, groopay-build-spec.md
  FAZ0-PLAN.md ... FAZ7-PLAN.md
  CLAUDE.md
  SESSION-OZET.md
  .env
```

## Faz 8 İçin Hazırlık

OAuth (Google + Apple), dev build (EAS), hesap silme, veri dışa aktarma, gizlilik/şartlar URL'leri, ikon/splash/ekran görüntüleri, RevenueCat webhook deploy, gerçek IAP testi (sandbox), EAS Build ile iOS + Android derleme, TestFlight.
