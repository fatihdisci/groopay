# Groopay — Faz 8: Dev Build + OAuth + Mağaza + Yayın (Kit)

> **Faz 8 nedir?** Finalin kendisi. Uygulamayı gerçek dünyaya bağlama: dev build, gerçek giriş, RevenueCat canlı, push aktif, mağaza hazırlık, yayın.
> 
> **Bu faz öncekilerden farklı.** Çok daha fazla "senin elinle panel doldurma" var. Her adımda ne yapacağın, hangi siteye gireceğin, neye tıklayacağın tek tek yazılı. Kod tarafını agent hallediyor; panel işleri sende.
>
> **Önerilen sıra:** Adımları SIRAYLA yap. Birini atlarsan sonraki kırılır.

---

## GENEL BAKIŞ — Ne Değişiyor?

| Şu An (Expo Go) | Faz 8 Sonrası |
|---|---|
| Anonim auth | Gerçek Google + Apple girişi |
| Expo Go test | Kendi imzalı development build |
| Push yok | Gerçek push bildirimi |
| RevenueCat test modu | Gerçek IAP satın alma |
| Mağazada yok | App Store + Google Play'de yayında |

---

## BÖLÜM A — SENİN ELİNLE: HESAPLAR (Önce bunları aç)

> Bu hesaplar olmadan hiçbir şey derlenmez, test edilemez, yayınlanamaz. Sırayla aç.

### A1. Apple Developer Hesabı ($99/yıl) ⭐ EN ÖNEMLİ

**Nereye:** https://developer.apple.com/enroll

**Adımlar:**
1. Siteye gir → "Start Your Enrollment"
2. Mevcut Apple ID ile giriş yap (yeni açmana gerek yok)
3. **Enrollment type:** "Individual / Sole Proprietor" seç (şirket adına değil)
   - Mağazada senin gerçek adın görünür (örn. "Fatih Disci")
   - Birden fazla app çıkarınca şirket adına geçmeyi düşünebilirsin, ama şimdilik Individual yeter
4. Kimlik doğrulama adımlarını tamamla
5. **Ödemeyi mobilden yap** (web'de daha pahalı çıkıyor — bunu zaten yaşadın)
   - iPhone'da Apple Developer uygulamasını aç
   - "Enroll" seçeneği çıkmazsa birkaç saat bekle (withdraw sonrası sistem temizleniyor)
6. Onay e-postası gelir — genellikle birkaç saat, bazen 1-2 gün sürer

> ⚠️ Bu olmadan iOS build imzalanamaz, TestFlight'a yüklenemez, mağazaya gönderilemez.

---

### A2. Google Play Console ($25 tek sefer)

**Nereye:** https://play.google.com/console

**Adımlar:**
1. Google hesabınla giriş yap
2. "Create developer account"
3. Bilgileri doldur (isim, adres, telefon)
4. $25 ödeme (kredi kartı)
5. Hesap hemen aktif olur

> Google tarafı Apple'a göre çok daha hızlı ve kolay.

---

### A3. RevenueCat Hesabı (Ücretsiz)

**Nereye:** https://app.revenuecat.com/signup

**Adımlar:**
1. E-posta ile kayıt ol (ücretsiz)
2. "Create new project" → proje adı: "Groopay"
3. Şimdilik boş bırak — ürünleri A5 ve A6'da ekleyeceksin

---

### A4. Expo (EAS) Hesabı (Ücretsiz)

**Nereye:** https://expo.dev/signup

**Adımlar:**
1. E-posta ile kayıt ol
2. Hesap açılınca terminalde şunu çalıştır:
   ```
   npx eas-cli login
   ```
   → Kullanıcı adı ve şifreni gir

---

### A5. App Store Connect — Uygulama + Ürün Kaydı

> Apple Developer hesabın onaylandıktan SONRA yap.

**Nereye:** https://appstoreconnect.apple.com

**Uygulama oluşturma:**
1. "My Apps" → "+" → "New App"
2. Bilgileri doldur:
   - **Platform:** iOS
   - **Name:** Groopay
   - **Primary Language:** Turkish
   - **Bundle ID:** Yeni oluştur → "com.fatih.groopay" (ya da agent'ın yazdığı Bundle ID'yi kullan — `app.json`'da kontrol et)
   - **SKU:** groopay-ios (benzersiz bir kod)
3. "Create"

**IAP Ürünleri oluşturma:**
1. Sol menü → "In-App Purchases" → "+"
2. **Grup Pro:**
   - Type: "Non-Consumable" (tek seferlik, kalıcı)
   - Reference Name: "Groopay Group Pro"
   - Product ID: `com.fatih.groopay.grouppro`
   - Fiyat: istediğin fiyat katmanını seç
   - Localizations: Türkçe + İngilizce açıklama ekle
3. **User Pro:**
   - Type: "Auto-Renewable Subscription"
   - Reference Name: "Groopay User Pro"
   - Product ID: `com.fatih.groopay.userpro`
   - Subscription Group oluştur: "Groopay Pro"
   - Fiyat + süre: aylık veya yıllık seç

> ⚠️ Ürün ID'lerini (`com.fatih.groopay.grouppro` vb.) not al — agent'a verirken lazım olacak.

---

### A6. Google Play Console — Uygulama + Ürün Kaydı

**Nereye:** https://play.google.com/console

**Uygulama oluşturma:**
1. "Create app"
2. Bilgileri doldur:
   - **App name:** Groopay
   - **Default language:** Turkish
   - **App or game:** App
   - **Free or paid:** Free
3. Temel kurulum adımlarını tamamla (onlarca checkbox — hepsini doldur, 20-30 dk sürer)

**IAP Ürünleri:**
1. Sol menü → "Monetize" → "In-app products"
2. **Grup Pro:** Product ID: `grouppro`, One-time product
3. **User Pro:** Sol menü → "Subscriptions" → Product ID: `userpro`

---

### A7. Gizlilik Politikası + Kullanım Şartları

Her iki mağaza da URL ister. En kolay yol:

1. Vercel'de yeni bir proje aç (ya da law2do.com'un altına ekle)
2. `/privacy` ve `/terms` sayfaları oluştur
3. İçerik için agent'tan "Groopay için KVKK uyumlu gizlilik politikası ve kullanım şartları metni yaz" de
4. URL'leri not al: `https://groopay.app/privacy`, `https://groopay.app/terms`

> **KVKK notu (seni ilgilendiriyor):** Uygulama anonim kullanıcı verisi topluyor, Supabase'de saklıyor. Gizlilik politikasında "Frankfurt'ta barındırılıyor, IBAN saklanmıyor" gibi Türkiye özelinde önemli noktalar olsun. Bu senin uzmanlık alanın, metni agent'a yazdırtsan bile sen gözden geçir.

---

## BÖLÜM B — KOD TARAFINDAN AGENT YAPACAK

> Tüm A adımlarını tamamladıktan sonra bu promptu Claude Code'a ver.

```
Groopay Faz 8'i uygula. Bu, uygulamanın gerçek dünyaya bağlandığı final fazı. Türkçe iletişim, kod İngilizce. ÖNCE SESSION-OZET.md + docs/groopay-build-spec.md + docs/groopay-scope.md + CLAUDE.md oku.

# Faz 8 kapsamı
EAS build konfigürasyonu + gerçek Google/Apple OAuth + RevenueCat canlı API key'leri + push aktifleştirme + hesap silme/veri aktarma (Apple zorunlu) + gizlilik/şartlar ekranı + deep linking + ikon/splash + store metadata.

# Bilgiler (başlamadan önce bunları benden iste, sonra devam et)
1. Bundle ID (app.json'daki mevcut değer neyse söyle, onaylayayım)
2. Supabase Project URL: https://dtlnujqtwlncwrxunihj.supabase.co (mevcut)
3. RevenueCat Apple API key (ben vereceğim)
4. RevenueCat Google API key (ben vereceğim)
5. Group Pro Product ID (App Store): com.fatih.groopay.grouppro
6. User Pro Product ID (App Store): com.fatih.groopay.userpro
7. Group Pro Product ID (Play Store): grouppro
8. User Pro Product ID (Play Store): userpro
9. Gizlilik URL: (ben vereceğim)
10. Şartlar URL: (ben vereceğim)

## 1. EAS Build Konfigürasyonu
- eas.json oluştur: development, preview, production profilleri.
  - development: Expo dev client, iOS simulator + device.
  - production: App Store + Play Store'a gönderilecek.
- app.json güncellemeleri:
  - `expo.ios.bundleIdentifier`: com.fatih.groopay
  - `expo.android.package`: com.fatih.groopay
  - `expo.scheme`: "groopay" (deep link için — zaten var mı kontrol et)
  - `expo.ios.supportsTablet`: false (telefon öncelikli)
  - `expo.plugins`: react-native-purchases plugin zaten var, kontrol et.
- `eas build:configure` komutunu çalıştır (EAS'ı projeye bağlar).

## 2. Gerçek Google + Apple OAuth (Faz 1B)
Mevcut anonim auth'u gerçek OAuth'a yükselt. lib/auth/ içindeki soyutlama korunacak.

- Supabase Dashboard → Authentication → Providers:
  - **Google:** Aktifleştir. Client ID + Secret için Google Cloud Console gerekir. BANA adımları anlat (Console'da nasıl OAuth credential oluşturulur).
  - **Apple:** Aktifleştir. Apple Developer'da "Sign in with Apple" Service ID gerekir. BANA adımları anlat.
- lib/auth/AuthContext.tsx güncelle:
  - `signIn()`: artık `supabase.auth.signInWithOAuth({provider: 'google'})` + `supabase.auth.signInWithOAuth({provider: 'apple'})`.
  - Anonim kullanıcıyı gerçek hesaba yükseltme: `supabase.auth.linkIdentity({provider})` — mevcut anonim kullanıcı için bunu dene; başarısız olursa yeni oturum aç ve veriyi geçir.
  - Giriş ekranında (sign-in.tsx): "Test kullanıcısı" butonunu KALDIR, Google + Apple butonları aktif (dev build'de çalışır, Expo Go'da çalışmaz — zarif mesaj).
- Deep link callback: `groopay://auth/callback` (OAuth redirect için). app.json scheme ile uyumlu olsun.

## 3. RevenueCat Canlı Key'leri
- .env'e gerçek key'leri ekle:
  ```
  EXPO_PUBLIC_REVENUECAT_APPLE_KEY=<ben vereceğim>
  EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY=<ben vereceğim>
  ```
- lib/revenuecat/index.ts'de ürün ID'lerini sabitler olarak tanımla (A5-A6'dan aldıklarım).
- Offering yapısını RevenueCat Dashboard'dakiyle eşleştir.

## 4. Push Bildirimi Aktifleştirme
- Expo Go'da çalışmıyordu, dev build'de çalışacak.
- app.json'a push notification entitlement ekle (iOS için `expo.ios.entitlements`).
- Apple Developer'da "Push Notifications" capability'yi etkinleştir — BANA nasıl yapılacağını anlat.
- lib/notifications/index.ts'deki `registerPushToken()` zaten hazır; dev build'de test edilebilir hale gelecek.
- `send-push` Edge Function deploy adımlarını ver (Supabase CLI veya Dashboard).

## 5. Hesap Silme + Veri Dışa Aktarma (Apple ZORUNLU)
Apple, hesap açan uygulamalarda uygulama içi hesap silme ister.
- `supabase/functions/delete-account/index.ts` Edge Function oluştur:
  - JWT'den kullanıcıyı doğrula.
  - `auth.users`'dan kullanıcıyı sil (cascade ile tüm verisi silinir — Faz 2 şemasında `on delete cascade` zaten var).
  - Service-role key ile çalışır.
- Hesap ekranına "Hesabı Sil" butonu ekle: onay dialog'u → Edge Function çağrısı → çıkış + giriş ekranı.
- Veri dışa aktarma (KVKK hakkı):
  - `supabase/functions/export-data/index.ts`: kullanıcının tüm verisini (gruplar, masraflar, üyelikler) JSON olarak döner.
  - Hesap ekranına "Verilerimi İndir" butonu.
- BANA her iki Edge Function'ı Dashboard'dan nasıl deploy edeceğimi anlat.

## 6. Gizlilik Politikası + Kullanım Şartları
- app/(tabs)/account.tsx'e "Gizlilik Politikası" ve "Kullanım Şartları" linkleri ekle (Linking.openURL ile dış tarayıcıda açılır).
- URL'leri .env veya constants'tan okusun (ben vereceğim).
- i18n: `account.privacy`, `account.terms` anahtarları.

## 7. Uygulama İkonu + Splash Screen
- assets/ klasöründe mevcut ikon/splash var mı kontrol et.
- Gerekli dosyalar:
  - iOS ikon: 1024x1024px PNG (şeffaf arka plan YOK, düz renk olmalı)
  - Android ikon: 1024x1024px + adaptive icon (ön plan + arka plan ayrı)
  - Splash screen: 1284x2778px PNG
- Eğer assets'te placeholder varsa, BANA "şu boyutlarda şu dosyaları hazırla ve buraya koy" de — görselleri ben hazırlayıp koyacağım, sen app.json'u kur.
- app.json'da `expo.icon`, `expo.splash`, `expo.android.adaptiveIcon` doğru şekilde tanımlı olsun.

## 8. Deep Linking (Davet Linki)
- Faz 3'te davet linki `groopay://join/TOKEN` olarak kurulmuştu, ama Expo Go'da tam çalışmıyordu.
- Dev build'de çalışacak: app.json scheme + Expo Router deep link handler doğru kurulu mu kontrol et.
- Universal Link (HTTPS): App Store'da kullanıcı linke tıklayınca tarayıcı yerine uygulama açılsın. `apple-app-site-association` dosyası gerekir — BANA nasıl kuracağımı anlat.

## 9. Store Metadata
- app.json'da eksik alanları tamamla:
  - `expo.version`: "1.0.0"
  - `expo.ios.buildNumber`: "1"
  - `expo.android.versionCode`: 1
  - `expo.owner`: EAS hesap kullanıcı adı
- Mağaza açıklamaları için bana draft metinler yaz (App Store + Google Play, Türkçe + İngilizce, 4000 karakter altı). Başlık, kısa açıklama, tam açıklama.

## 10. Son Kontroller
- npx tsc --noEmit temiz.
- `npx expo-doctor` çalıştır, uyarıları giderel.
- package.json'da `eas:build:ios` ve `eas:build:android` script'leri ekle.

# YAPMA
- Gerçek IAP test / sandbox test (bunu benim çalıştırmam gerekiyor).
- Mağazaya gerçek submit (ben yapacağım, adımları ver).

# Sıralama (BUNU TAKİP ET)
1. Önce bilgileri benden iste (RevenueCat key'leri, URL'ler vb.)
2. EAS konfigürasyonu
3. OAuth kurulumu (bana Supabase + Google Cloud + Apple adımlarını ver)
4. RevenueCat key'leri + ürün ID'leri
5. Push + hesap silme + veri aktarma
6. Gizlilik/şartlar + deep link
7. İkon/splash (dosyaları benden bekle)
8. Store metadata + doctor + temizlik
9. Bitince: `eas build --platform ios --profile development` komutunu ver ve bana ne beklediğimi söyle

Bitince: değişen dosyalar, deploy edilecek Edge Function'lar (nasıl deploy edeceğim adım adım), ve tam EAS build + TestFlight + App Store submit adımları.
```

---

## BÖLÜM C — EAS BUILD VE DAĞITIM (Agent bitince sen yapacaksın)

> Agent kodu yazdıktan ve EAS'ı konfigüre ettikten sonra bu adımları uygula.

### C1. İlk iOS Development Build

```powershell
cd C:\Users\fatih\groopay
eas build --platform ios --profile development
```

- Build başlar, bulutta derlenir (~15-20 dk).
- Biter → URL gelir → QR kodu verir.
- **iPhone'unda TestFlight uygulaması açık olmalı.**
- URL'i Safari'de aç → "Install" → iPhone'una kurulur.
- Artık Expo Go değil, **kendi uygulamanı** kullanıyorsun.

> 🎉 Bu noktada gerçek giriş, push, RevenueCat hepsi test edilebilir.

### C2. Sandbox Testleri (Dev Build Kurulduktan Sonra)

**RevenueCat Sandbox:**
1. App Store Connect → "Users and Access" → "Sandbox Testers" → test hesabı oluştur
2. iPhone'da: Settings → App Store → Sandbox Account → test hesabını ekle
3. Uygulamada paywall → satın al → sandbox hesabıyla giriş yap (gerçek para çekilmez)
4. Supabase Dashboard → `groups` tablosuna bak → `is_pro = true` yazıldı mı?
5. `profiles` tablosuna bak → `user_pro = true` yazıldı mı?

**Push Testi:**
1. Uygulamayı aç → push izni ver
2. Supabase Dashboard → `profiles` tablosu → `expo_push_token` dolu mu?
3. Başka bir kullanıcı masraf eklesin → push bildirimi düşüyor mu?

### C3. Production Build (Mağazaya Göndermeden Önce)

```powershell
# iOS
eas build --platform ios --profile production

# Android
eas build --platform android --profile production
```

### C4. App Store'a Yükleme

```powershell
# Build bittikten sonra:
eas submit --platform ios
```

Ya da: App Store Connect → "TestFlight" → build'i yükle → dahili test yap → App Store Review'a gönder.

### C5. Google Play'e Yükleme

```powershell
eas submit --platform android
```

Ya da: Play Console → "Internal testing" → APK/AAB yükle → test et → Production'a al.

---

## BÖLÜM D — MAĞAZA HAZIRLIKLARI

### D1. Uygulama İkonu (Senin hazırlaman gerekiyor)

**Gereksinimler:**
- 1024x1024px PNG, şeffaf arka plan YOK
- Düz renkli arka plan (Groopay'in moru: #4F46E5)
- Ortada basit bir "G" veya bölüşme ikonu (ComfyUI/Flux ile üretebilirsin)
- Metinli ikon Apple tarafından reddedilebilir — sadece sembol/harf

**Splash screen:** 1284x2778px, basit: mor arka plan + ortada beyaz logo

### D2. Ekran Görüntüleri (ASO)

3 temel görsel — her biri için prompt sana önceden verildi:
1. Gruplar listesi → "Masrafları saniyede böl"
2. Bakiye ekranı → "Kim kime ne borçlu, anında gör"  
3. Grup detayı → "Herkes üye olmak zorunda değil"

**Boyutlar:**
- iPhone 6.9": 1320×2868px (App Store'da zorunlu)
- iPhone 6.5": 1242×2688px (opsiyonel ama iyi)
- Android: 1080×1920px

**Şimdi değil, dev build aldıktan sonra.** Gerçek giriş + gerçek verilerle temiz ekranlar al.

### D3. Mağaza Açıklamaları (Agent yazacak)

Prompt'ta agent'tan draft istiyoruz. Şunları içermeli:
- **Başlık:** "Groopay — Masraf Bölüşme"
- **Alt başlık:** "Kim kime ne borçlu, anında gör"
- **Öne çıkan:** "Uygulama indirmeden kullan" (hayalet üye)
- **Anahtar kelimeler (ASO):** masraf, bölüşme, borç takibi, ev arkadaşı, tatil masrafı, para hesabı

---

## BÖLÜM E — KONTROL LİSTESİ (Yayın Öncesi)

### Teknik
- [ ] `npx tsc --noEmit` temiz
- [ ] `npx expo-doctor` temiz
- [ ] EAS konfigürasyonu tamamlandı
- [ ] Bundle ID + package name App Store Connect / Play Console ile eşleşiyor
- [ ] Deep linking çalışıyor (davet linki açılıyor)

### Auth
- [ ] Google ile giriş çalışıyor (dev build'de)
- [ ] Apple ile giriş çalışıyor (dev build'de)
- [ ] Anonim → gerçek hesap yükseltme çalışıyor veya yeni hesap akışı temiz

### Monetizasyon
- [ ] App Store + Play Store'da ürünler oluşturuldu
- [ ] RevenueCat'te ürünler bağlandı, offerings yapılandırıldı
- [ ] Webhook deploy edildi, secret ayarlandı
- [ ] Sandbox: Grup Pro satın alma → `groups.is_pro = true`
- [ ] Sandbox: User Pro satın alma → `profiles.user_pro = true`
- [ ] Restore purchases çalışıyor

### Apple Zorunluları (reddedilmemek için)
- [ ] "Hesabı Sil" butonu var ve çalışıyor
- [ ] "Verilerimi İndir" var ve çalışıyor
- [ ] "Apple ile Giriş" var (Google girişi sunduğun için zorunlu)
- [ ] "Satın alımları geri yükle" butonu var
- [ ] Gizlilik Politikası URL'si var
- [ ] Kullanım Şartları URL'si var

### Push
- [ ] Push izni isteniyor (ilk açılışta veya uygun anda)
- [ ] Token `profiles.expo_push_token`'a yazılıyor
- [ ] `send-push` Edge Function deploy edildi
- [ ] Gerçek push testi yapıldı

### Mağaza
- [ ] İkon hazır (1024x1024px, şeffafsız)
- [ ] Splash screen hazır
- [ ] En az 3 ekran görüntüsü hazır (1320x2868px)
- [ ] Türkçe + İngilizce açıklama yazıldı
- [ ] Kategori: Finance
- [ ] Yaş sınırı: 4+ (şiddet, yetişkin içerik yok)
- [ ] Gizlilik soruları App Store Connect'te dolduruldu (veri toplama)

---

## BÖLÜM F — SONRAYA KALAN (POST-LAUNCH)

Bunlar yayın sonrası, acele değil:

- **Webhook iyileştirme:** `CANCELLATION`, `EXPIRATION`, `REFUND` olayları → User Pro iptalinde `user_pro = false` yaz.
- **Fiş/OCR:** Pro özelliği, kapısı var. Expo Camera + Google Vision / OpenRouter ile.
- **Tekrarlayan masraf:** Pro özelliği. Supabase cron (pg_cron) veya Edge Function + zamanlanmış tetikleyici.
- **Dışa aktarma:** Pro özelliği. Masrafları PDF/CSV'e.
- **Gelişmiş grafikler:** Pro + dashboard. Recharts/Victory Native ile.
- **SDK yükseltme:** SDK 54 → güncel (dev build aldıktan sonra revizyonlar için)
- **Universal Links:** Davet linklerinin tarayıcıda değil uygulamada açılması.
- **App Tracking Transparency:** iOS 14+ reklamcılık tracking izni (şimdilik reklam yok, gerekmez).

---

## NOTLAR

- **Apple onay süresi:** App Store Review genellikle 1-3 gün. Reddetme sebebi gelirse korkma; genellikle küçük düzeltmelerle çözülür. En sık reddetme: hesap silme yok, gizlilik soruları eksik — ikisi de kontrol listesinde var.
- **Google Play onay:** Çok daha hızlı, genellikle birkaç saat-1 gün.
- **TestFlight:** Yayına geçmeden önce 30 güne kadar 10.000 beta test kullanıcısına dağıtabilirsin. Yakın çevrenle dene.
- **Fiyatlandırma:** Grup Pro ve User Pro için fiyat kararını vermemiştin — mağazaya girmeden önce netleştir. Türkiye için App Store fiyat katmanları var, TRY'de gösterilir.
- **Groopay.app domain:** Mağaza sayfasında "destek URL" ve gizlilik URL'si lazım. Vercel'de basit bir landing page yeterli.
