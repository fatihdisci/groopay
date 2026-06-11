# Groopay — Bugfix & Cila Günlüğü (2. Defter)

> Devamı: [`BUGFIX-CILA.md`](BUGFIX-CILA.md) (B1–B129)
> Bu dosya B130 ile başlar.

---

### ✅ B130: Pro aktivasyon zinciri deterministik yapıldı (TRANSFER/REFUND + sync-pro-status) + paywall düzeltmeleri

**Sorun:** RevenueCat → Supabase Pro aktivasyonu şu somut olayla koptu: kullanıcı hesap değiştirince RevenueCat aboneliği yeni App User ID'ye **TRANSFER** etti (RC customer history'de "Got their purchases transferred from 8f57ab52…" kaydı). RC bu anda `TRANSFER` tipi webhook event'i gönderir; `revenuecat-webhook` içinde `TRANSFER` ne `GRANT_EVENTS` ne `REVOKE_EVENTS` listesindeydi → event "skip" ediliyordu → entitlement RC'de doğru kullanıcıda olmasına rağmen `profiles.user_pro` hiç güncellenmiyordu.

Ek sorunlar:
1. `REFUND` hiçbir listede yoktu → Apple iadesi Pro'yu kaldırmıyordu.
2. RC bazı event'lerde `entitlement_ids` alanını boş gönderiyor (canlı logda görüldü); grant sadece `product_id` fallback'iyle tutuyordu.
3. Aktivasyonun tek yolu webhook'tu; kaçan/skip edilen tek event kullanıcıyı kalıcı olarak Pro'suz bırakıyordu. Deterministik bir senkron yol (`sync-pro-status`) yoktu.
4. Kullanıcı zaten abone iken satın alma butonuna basınca `Purchases.purchasePackage` promise'i hiç resolve olmuyordu → paywall CTA'sı sonsuz spinner'da kalıyordu.
5. Paywall ekranında CTA + legal linkler ilk ekranda görünmüyordu (scroll gerekiyordu) → App Review riski.

**Yapılan:**
- `supabase/functions/revenuecat-webhook/index.ts`:
  - `REVOKE_EVENTS` listesine `REFUND` eklendi. (`CANCELLATION` EKLENMEDİ — iptal, süre sonuna kadar erişimi korur; mevcut davranış doğru.)
  - `RevenueCatEvent` interface'ine `transferred_from?: string[]` ve `transferred_to?: string[]` eklendi.
  - Event sınıflandırmasından ÖNCE `TRANSFER` için özel blok: `transferred_from` içindeki UUID'lerden Pro kaldırılır, `transferred_to` içindeki UUID'lere Pro verilir (`user_pro: true` + `user_pro_purchased_at`). Yanıt: `{ success: true, action: 'transfer_processed', granted_to }`. (TRANSFER'de `app_user_id`/`entitlement_ids` güvenilir değildir; kimlik transferred_to/from dizilerindedir. Expiration safety-net bu blokta uygulanmaz — gerçek aktiflik `sync-pro-status` ile doğrulanır.)
  - Mevcut grant/revoke akışına dokunulmadı.
- **Yeni Edge Function** `supabase/functions/sync-pro-status/index.ts`:
  - Webhook'tan bağımsız, **pull-based** doğrulama. `verify_jwt` AÇIK (default); kullanıcı JWT'siyle çağrılır.
  - Anon-key client + `auth.getUser(jwt)` ile `userId` çözülür; çözülemezse 401.
  - RC REST API: `GET https://api.revenuecat.com/v1/subscribers/${userId}` (`Authorization: Bearer ${REVENUECAT_SECRET_API_KEY}`). 4xx/5xx/fetch hatası → `{ success:false, error:'revenuecat_unreachable' }` + 502, DB'ye DOKUNULMAZ.
  - Pro tespiti (ikisinden biri yeterli): `entitlements['user_pro'].expires_date > now` VEYA `subscriptions['com.groopay.app.userpro'].expires_date > now` (iptal ≠ erişim kaybı — `unsubscribe_detected_at` dolu olsa bile süre geçmediyse aktif).
  - Service-role client ile `profiles.user_pro` set edilir (aktifse `user_pro_purchased_at` = entitlement `purchase_date`). Yanıt: `{ success: true, user_pro, expires_at }`.
  - Loglar `[sync-pro] user / rc status / entitlement expires / db updated` formatında, PII'siz.
- `lib/revenuecat/index.ts`:
  - `withTimeout` helper'ı (Promise.race + sentinel + timer cleanup). `Purchases.purchasePackage` 90 sn timeout'la sarıldı → timeout'ta `{ success:false, error:'purchase_timeout' }`. `Purchases.restorePurchases` 60 sn → `error:'restore_timeout'`. (B119'daki "Promise.race kaldırıldı" kuralı Supabase token refresh içindi; StoreKit sheet'i için timeout gerekli ve güvenli.)
- **Yeni dosya** `lib/revenuecat/syncProStatus.ts`: `supabase.functions.invoke('sync-pro-status')` çağırır (accessToken callback'li client JWT'yi otomatik enjekte eder); `user_pro === true` döner.
- `app/paywall.tsx`:
  - `waitForProActivation`: İLK denemeden önce ve her 3 denemede bir `syncProStatus()` çağırıyor; `true` dönerse hemen `refreshProfile()` + return true. (Webhook gecikse de sync anında çözer.)
  - `purchaseUserProNow`: `result.error === 'purchase_timeout'` → `paywall.purchaseTimeout` mesajı.
  - `handleRestore`: restore başarısız/boş olsa bile son adım olarak `syncProStatus()` deneniyor; `true` ise başarı akışına giriliyor. `restore_timeout` → `purchaseTimeout` mesajı.
  - **Layout sıkılaştırma** (hedef: 390×844'te scroll'suz CTA + legal linkler): header `paddingTop` 56→34, `paddingBottom` 36→22 (~%40 azalma), diamond ikon 40→28 (kutu 80→56), title font 28→24; feature satırları `paddingVertical` 16→8 (satır ~52px), ikon kutusu 44→36; `featuresSection` marginBottom 32→20; `priceCard` padding 20→16, `priceRow` marginBottom 12→8; `limitNote` marginTop 12→8, padding 12→10; `legalLinks` paddingVertical 16→8; CTA marginTop 16→8, `minHeight: 50` (44px dokunma kuralı korunur); `content`'e `flexGrow: 1` eklendi (paddingBottom 48 mevcut — restore satırı küçük ekranda kesilmez). Renk/radius/gradient aynen korundu.
- `app/(tabs)/account.tsx`: "Satın alımları geri yükle" aksiyonuna aynı `syncProStatus()` fallback'i eklendi (restore başarılı ama profil güncellenmemişse VE restore boş/başarısızsa).
- `locales/tr.json` + `locales/en.json`: `paywall.purchaseTimeout` eklendi (TR: "İşlem zaman aşımına uğradı. Aboneliğiniz başladıysa 'Satın alımları geri yükle'yi deneyin." / EN: "The transaction timed out. If your subscription started, try 'Restore purchases'.").

**Değişen dosyalar:** `supabase/functions/revenuecat-webhook/index.ts`, `supabase/functions/sync-pro-status/index.ts` (yeni), `lib/revenuecat/index.ts`, `lib/revenuecat/syncProStatus.ts` (yeni), `app/paywall.tsx`, `app/(tabs)/account.tsx`, `locales/tr.json`, `locales/en.json`, `BUGFIX-CILA-2.md` (yeni)

**Deploy gereksinimleri (manuel):**
1. Supabase Vault'a **YENİ secret**: `REVENUECAT_SECRET_API_KEY` (RC dashboard → API Keys → Secret key, `sk_` prefix).
2. `npx supabase functions deploy revenuecat-webhook` (güncellendi) + `npx supabase functions deploy sync-pro-status` (yeni, `verify_jwt` default AÇIK kalmalı — `--no-verify-jwt` KULLANMA).

**Test:**
1. `npx tsc --noEmit` ✅ temiz
2. `npm test` ✅ 87/87 test geçti

**Manuel kabul kriterleri:**
1. Webhook'a sahte `TRANSFER` payload'u (`transferred_to: [<gerçek profil uuid>]`, `transferred_from: [<rastgele uuid>]`) POST edilince ilgili profilde `user_pro=true` oluyor ve yanıt `transfer_processed`.
2. Webhook'a `REFUND` event'i `user_pro=false` yapıyor.
3. `sync-pro-status` geçerli JWT ile çağrılınca RC'deki gerçek duruma göre `profiles.user_pro` set ediliyor; JWT'siz 401.
4. Paywall: zaten-abone durumda satın alma denemesi 90 sn içinde spinner'ı bırakıyor ve `purchaseTimeout` mesajı gösteriyor.
5. 390×844 simülatörde paywall CTA + legal linkler ilk ekranda görünüyor.

| Kontrol | Durum |
|---|---|
| TRANSFER event'i işleniyor (eski sahipten al, yeni sahibe ver) | ✅ |
| REFUND → user_pro=false | ✅ |
| Pull-based sync yolu (`sync-pro-status`) mevcut | ✅ |
| Purchase 90 sn / restore 60 sn timeout | ✅ |
| Paywall CTA + legal linkler ilk ekranda (390×844) | ✅ kod tarafı (cihaz testi bekliyor) |
| TypeScript temiz | ✅ |
| 87/87 test geçiyor | ✅ |

*Son güncelleme: 2026-06-11 — B130 eklendi*
