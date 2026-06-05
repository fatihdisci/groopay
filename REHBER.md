# Groopay Faz 8 — Adım Adım Kurulum Rehberi

> **Amaç:** Uygulamayı Expo Go'dan çıkarıp gerçek iOS build'i almak, Google + Apple girişini aktifleştirmek, RevenueCat IAP'yi bağlamak.
>
> **Süre:** Tüm adımlar ~2-3 saat (beklemeler hariç).
>
> **Ön koşul:** Apple Developer Program üyeliği onaylanmış olmalı (✅ tamam).

---

## İÇİNDEKİLER

1. [Genel Bakış — Hangi anahtar nereden alınır, nereye konur](#1-genel-bakış)
2. [Apple Developer — 3 Anahtar + App ID + Service ID](#2-apple-developer)
3. [Google Cloud Console — OAuth Client ID](#3-google-cloud-console)
4. [Supabase — Provider'ları Aktifleştirme](#4-supabase)
5. [RevenueCat — İlk Kurulum](#5-revenuecat)
6. [EAS — Build Sistemi](#6-eas)
7. [App Store Connect — Uygulama + IAP Ürünleri](#7-app-store-connect)
8. [RevenueCat — Ürünleri Bağlama](#8-revenuecat-ürün-bağlama)
9. [TestFlight — İlk Dağıtım](#9-testflight)
10. [Kontrol Listesi](#10-kontrol-listesi)

---

## 1. GENEL BAKIŞ

Bu kurulumda **5 farklı platform** arasında mekik dokuyacağız:

```
Apple Developer  ──→  App Store Connect  ──→  RevenueCat
     │                                            │
     └──→  Supabase  ←──  Google Cloud Console    │
              │                                   │
              └──→  Expo (EAS)  ←─────────────────┘
```

**Hangi anahtar nerede kullanılır:**

| Anahtar | Nereden Alınır | Nereye Konur |
|---|---|---|
| **Bundle ID** (`com.groopay.app`) | Sen belirledin | Apple Developer, App Store Connect, app.json |
| **.p8 Private Key** | Apple Developer → Keys | Supabase (Apple Provider) + RevenueCat (Apple IAP) |
| **Team ID** | Apple Developer (sağ üst) | Supabase, RevenueCat |
| **Key ID** | Apple Developer → Keys | Supabase, RevenueCat |
| **Service ID** | Apple Developer → Identifiers | Supabase (Apple Provider) |
| **Google Client ID** | Google Cloud Console | Supabase (Google Provider) |
| **Google Client Secret** | Google Cloud Console | Supabase (Google Provider) |
| **RevenueCat Apple Key** | RevenueCat → Settings → Apple | Otomatik (RevenueCat kendi üretir, .p8 ile bağlanır) |
| **RevenueCat Google Key** | RevenueCat → Settings → Google | Otomatik (RevenueCat kendi üretir, service account ile bağlanır) |
| **Supabase URL + Anon Key** | Supabase Dashboard → Settings → API | `.env` (zaten var) |

---

## 2. APPLE DEVELOPER

**Site:** https://developer.apple.com → Apple ID ile giriş → "Account"

### 2.1 Team ID'ni Not Al

- Sağ üst köşede adının altında **Team ID** yazar (10 karakterli, harf+rakam).
- İleride Supabase ve RevenueCat'te lazım olacak.
- **Şimdi not al:** `____________________`

### 2.2 App ID (Bundle ID) Oluştur

- Sol menü → **"Certificates, Identifiers & Profiles"**
- **"Identifiers"** sekmesi → mavi **"+"** butonu
- **"App IDs"** → Continue
- Form:
  - **Description:** `Groopay`
  - **Bundle ID:** Explicit → `com.groopay.app`
  - **Capabilities:** Şimdilik SEÇME. (Sign In with Apple ve Push Notifications'ı sonra ekleyeceğiz.)
- Continue → Register

> ✅ `com.groopay.app` App ID'si oluştu.

### 2.3 Sign In with Apple — Service ID

Apple ile giriş için ayrı bir Service ID gerekir. Bu, uygulamanın arka planda Apple'dan kullanıcı bilgisi almasını sağlar.

- Aynı "Identifiers" sayfasında → **"+"** → **"Services IDs"**
- Description: `Groopay Auth`
- Identifier: `com.groopay.app.auth`
- Continue → Register

> ✅ Service ID oluştu: `com.groopay.app.auth`

### 2.4 App ID'ye Sign In with Apple Yeteneği Ekle

- Identifiers → **App IDs** → `com.groopay.app`'e tıkla
- **Capabilities** sekmesinde **"Sign In with Apple"** → Enable → **"Edit"**
- **"Sign In with Apple"** seçeneğini işaretle → Save
- Sayfanın başındaki **"Save"** butonuna bas

> ✅ App ID artık Sign In with Apple destekliyor

### 2.5 Private Key (.p8) Oluştur

Bu anahtar Supabase ve RevenueCat'in Apple adına işlem yapmasını sağlar.

- Sol menü → **"Keys"** → mavi **"+"**
- Key Name: `Groopay API`
- **"Sign In with Apple"** → Enable → **Configure**
  - Primary App ID: `com.groopay.app` seç
- **"Continue"** → **"Register"**
- **İNDİR butonuna bas** → `.p8` dosyası bilgisayarına iner.

> ⚠️ **KRİTİK:** Bu dosyayı **sadece bir kere** indirebilirsin. Kaybedersen yeniden oluşturman gerekir (eski anahtar iptal olur).

**.p8 dosyasını sakla:**
```
C:\Users\fatih\groopay\keys\AuthKey_XXXXXXXXXX.p8
```

- **Key ID**'yi not al (harfler+rakamlar, 10 karakter): `____________________`

### 2.6 App Store Connect API Anahtarı (.p8 — RevenueCat için)

RevenueCat'in IAP'leri yönetmesi için **ayrı bir .p8 anahtarı** daha gerekir. Bu, Sign In ile karıştırılmamalı — farklı yetki tipi.

- Aynı "Keys" sayfasında → **"+"**
- Key Name: `Groopay RevenueCat`
- **"App Store Connect API"** → Enable
  - Access: **"In-App Purchase"** (sadece IAP)
- Continue → Register → **İNDİR**
- Dosyayı sakla:
```
C:\Users\fatih\groopay\keys\AppStoreConnect_XXXXXXXXXX.p8
```
- Bu anahtarın **Key ID**'sini not al: `____________________`
- **Issuer ID**'yi de not al (Keys sayfasının en üstünde): `____________________`

> 📝 **ÖZET — Apple'dan aldıkların:**
> - Team ID: `__________`
> - App ID: `com.groopay.app`
> - Service ID: `com.groopay.app.auth`
> - Sign In Key ID: `__________` + `.p8` dosyası
> - RevenueCat Key ID: `__________` + Issuer ID: `__________` + `.p8` dosyası

---

## 3. GOOGLE CLOUD CONSOLE

**Site:** https://console.cloud.google.com → Google hesabınla giriş

### 3.1 Proje Oluştur

- Üstte "Select a project" → **"New Project"**
- Project name: `Groopay`
- Location: `No organization` (varsayılan)
- Create

### 3.2 OAuth Consent Screen

- Sol menü → **"APIs & Services"** → **"OAuth consent screen"**
- User Type: **External** → Create
- App name: `Groopay`
- User support email: kendi Gmail adresin
- Developer contact info: kendi Gmail adresin (aynı olabilir)
- Save and Continue
- Scopes: **"Add or Remove Scopes"** → hiçbirini seçme → Save and Continue
- Test users: kendi Gmail adresini ekle → Save and Continue → Back to Dashboard

### 3.3 OAuth Client ID Oluştur

- Sol menü → **"Credentials"** → üstte **"+ Create Credentials"** → **"OAuth client ID"**
- Application type: **Web application**
- Name: `Groopay`
- **Authorized redirect URIs** → **"+ Add URI"**:
  ```
  https://dtlnujqtwlncwrxunihj.supabase.co/auth/v1/callback
  ```
- Create

> 📝 **Google'dan aldıkların:**
> - Client ID: `__________.apps.googleusercontent.com`
> - Client Secret: `GOCSPX-__________`

---

## 4. SUPABASE

**Site:** https://supabase.com/dashboard → Groopay projesi

### 4.1 Google Provider

- Sol menü → **Authentication** → **Providers**
- **Google** → Enable
- **Client ID:** Google'dan aldığın Client ID'yi yapıştır
- **Client Secret:** Google'dan aldığın Client Secret'ı yapıştır
- **Save**

### 4.2 Apple Provider

- Aynı sayfada → **Apple** → Enable
- **Service ID:** `com.groopay.app.auth`
- **Team ID:** Apple'daki Team ID
- **Key ID:** Sign In için oluşturduğun Key ID
- **Private Key:** Sign In `.p8` dosyasını **Not Defteri ile aç**, içindeki TÜM metni kopyala (başındaki `-----BEGIN PRIVATE KEY-----` ve sonundaki `-----END PRIVATE KEY-----` dahil), buraya yapıştır
- **Save**

> ✅ Supabase'de Google + Apple girişi aktif.

### 4.3 Redirect URL'leri (Kontrol)

- Authentication → **URL Configuration**
- **Site URL:** Boş bırak (şimdilik)
- **Redirect URLs:** Şu URL'nin listede olduğundan emin ol:
  ```
  groopay://auth/callback
  ```
- Değilse ekle. Bu, mobil uygulamanın OAuth dönüşünü yakalaması için.

---

## 5. REVENUECAT

**Site:** https://app.revenuecat.com

### 5.1 Hesap + Proje

- RevenueCat hesabın yoksa: https://app.revenuecat.com/signup → kayıt ol
- Dashboard → **"+ Create Project"**
- Project name: `Groopay`
- Platform: **iOS** (şimdilik sadece iOS, Android sonra)

### 5.2 Apple App Store Connect Bağlantısı

RevenueCat'in senin adına IAP yönetebilmesi için App Store Connect API anahtarını bağlaman gerek.

- RevenueCat → Groopay projesi → sol menü **"Settings"** (⚙️) → **"App Store"**
- **"App Store Connect API Keys"** → **"+ Add"**
- Üç bilgi gir:
  - **Key Name:** `Groopay`
  - **Issuer ID:** Apple 2.6'dan aldığın Issuer ID
  - **Key ID:** RevenueCat için oluşturduğun Key ID
  - **Private Key File:** RevenueCat `.p8` dosyasını **Not Defteri ile aç**, içindeki TÜM metni kopyala, yapıştır
- **"Add"**

### 5.3 Uygulama Ekle

- RevenueCat → sol menü **"Settings"** → **"App"**
- **"Apple App"** bölümü:
  - **App Name:** `Groopay`
  - **Bundle ID:** `com.groopay.app`
  - **App Store Connect Key:** Az önce eklediğin key'i seç
  - **Shared Secret:** BOŞ BIRAK (App Store Connect → In-App Purchases → App-Specific Shared Secret'tan alınır — bunu App Store Connect'te IAP ürünlerini oluşturduktan sonra ekleyeceğiz)

### 5.4 Entitlements ve Offerings (Şimdilik placeholder)

- Sol menü → **"Entitlements"** → **"+ New"**
  - Name: `user_pro`
  - Description: `Groopay User Pro (monthly)`
- Bir tane daha:
  - Name: `group_pro`
  - Description: `Groopay Group Pro (one-time)`

- **"Offerings"** → şimdilik boş bırak, IAP ürünlerini App Store Connect'te oluşturduktan sonra bağlayacağız (Bölüm 8).

---

## 6. EAS

EAS (Expo Application Services), uygulamayı bulutta derleyen Expo'nun build sistemidir.

### 6.1 EAS CLI Giriş

```powershell
npx eas-cli login
```

- Kullanıcı adı: `fatihdisci`
- Şifre: (Expo hesabının şifresi)

### 6.2 Projeyi EAS'e Bağla

```powershell
cd C:\Users\fatih\groopay
npx eas build:configure
```

- Platform seç: **All** (iOS + Android)
- Bu komut `app.json`'daki `extra.eas.projectId` alanını senin EAS proje ID'n ile günceller.

### 6.3 eas.json ve app.json Zaten Hazır

Kod tarafında `eas.json` ve `app.json` zaten yapılandırıldı:
- `eas.json`: development, preview, production profilleri
- `app.json`: `bundleIdentifier: com.groopay.app`, `package: com.groopay.app`, `scheme: groopay`, `owner: fatihdisci`

### 6.4 İlk Dev Build

```powershell
eas build --platform ios --profile development
```

- Build bulutta başlar, ~15-20 dk sürer
- Bitince bir URL ve QR kod verir
- iPhone'unda bu URL'i Safari'de aç → "Install" → uygulama cihazına yüklenir
- Artık **Expo Go değil**, kendi uygulamanı kullanıyorsun

---

## 7. APP STORE CONNECT

**Site:** https://appstoreconnect.apple.com

### 7.1 Uygulama Kaydı

> **Önce Bölüm 2.2'deki App ID'yi oluşturmuş olman gerekir!**

- "My Apps" → **"+"** → **"New App"**

| Alan | Değer |
|---|---|
| Platform | iOS |
| Name | Groopay |
| Primary Language | Turkish |
| Bundle ID | `com.groopay.app` (dropdown'dan seç) |
| SKU | `groopay-ios` |

- Create

### 7.2 Uygulama Bilgileri

Oluşturduktan sonra sol menüden sırayla doldur:

- **App Information:**
  - Category: **Finance**
  - Age Rating: **4+** (şiddet/yetişkin içerik yok)
  - Privacy Policy URL: `___________` (Vercel'de hazırlanacak, şimdilik boş geç)

- **Pricing and Availability:**
  - Price: **Free**

### 7.3 IAP Ürünleri Oluştur

Sol menü → **"In-App Purchases"** → **"+"**

#### 7.3a User Pro (Aylık Abonelik)

- Type: **Auto-Renewable Subscription**
- Reference Name: `Groopay User Pro`
- Product ID: `com.groopay.app.userpro`

Oluşturduktan sonra:

- **Subscription Group:** Yeni grup oluştur → Reference Name: `Groopay Pro`
- **Subscription Duration:** 1 Month
- **Price:** İstediğin fiyat katmanını seç (Türkiye için Tier 1 = ~₺39.99)
- **Localizations:** Ekle
  - Turkish: Display Name: `Groopay Pro`, Description: `Tüm gruplarını tek panelde gör, sınırsız grup oluştur, kategorilere göre analiz et.`
  - English: Display Name: `Groopay Pro`, Description: `View all groups in one dashboard, create unlimited groups, analyze by category.`

#### 7.3b App-Specific Shared Secret

RevenueCat'in abonelikleri yönetmesi için:

- Sol menü → **"In-App Purchases"** → sayfanın en üstünde **"App-Specific Shared Secret"** bağlantısı
- Generate → **Kopyala ve RevenueCat'e git**
- RevenueCat → Settings → App → Apple App → **Shared Secret** → yapıştır → Save

#### 7.3c Group Pro (Tek Seferlik — gelecekte kullanılmak üzere)

- Type: **Non-Consumable**
- Reference Name: `Groopay Group Pro`
- Product ID: `com.groopay.app.grouppro`
- Price: İstediğin fiyat
- Localizations: Yukarıdakine benzer ekle

### 7.4 Sandbox Tester Oluştur

Satın almayı test etmek için (gerçek para çekilmez):

- Sol menü → **"Users and Access"** → **"Sandbox"** → **"Testers"** → **"+"**
- First Name: `Test`
- Last Name: `User`
- Email: **kendi email'inden farklı bir email** (örn. `test+groopay@seninmail.com`)
- Password: (bir şifre belirle)
- Storefront: Turkey

> 📝 Sandbox hesabı bilgilerini not al. iPhone'da Settings → App Store → Sandbox Account'a bu hesabı ekleyeceksin.

---

## 8. REVENUECAT — ÜRÜNLERİ BAĞLAMA

App Store Connect'te IAP ürünlerini oluşturduktan sonra RevenueCat'e bağla.

### 8.1 Ürünleri İçe Aktar

- RevenueCat → Groopay projesi → **"Products"**
- **"Import from App Store Connect"** → ürünler otomatik gelir
- Gelmezse manuel ekle:
  - **"+ New"** → Apple App Store Product ID: `com.groopay.app.userpro`
  - **"+ New"** → Apple App Store Product ID: `com.groopay.app.grouppro`

### 8.2 Offering Oluştur

- Sol menü → **"Offerings"** → **"+ New Offering"**
- Offering Name: `default`
- **"Add Package"**:
  - Package Type: **Monthly**
  - Product: `com.groopay.app.userpro`
- **"Add Package"** (opsiyonel):
  - Package Type: **Lifetime**
  - Product: `com.groopay.app.grouppro`
- Save

> ✅ RevenueCat artık App Store'daki ürünleri görüyor ve API'den sunabiliyor.

### 8.3 RevenueCat API Anahtarları (.env'e)

- RevenueCat → Settings → **"API Keys"**
- **Apple Key:** RevenueCat Dashboard'da sana özel üretilir. `rc_apple_...` formatında.
  - `.env` dosyasına ekle: `EXPO_PUBLIC_REVENUECAT_APPLE_KEY=rc_apple_...`
- **Google Key:** Android'i sonra eklediğinde buradan alacaksın.
  - `.env` dosyasına ekle: `EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY=goog_...`

### 8.4 Webhook (Satın alma sonrası DB güncelleme)

Webhook, kullanıcı satın alınca RevenueCat'in Supabase'e bildirim göndermesini sağlar.

- RevenueCat → Settings → **"Webhooks"** → **"+ New"**
- URL: `https://dtlnujqtwlncwrxunihj.supabase.co/functions/v1/revenuecat-webhook`
- Events: hepsini seç (INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION, NON_RENEWING_PURCHASE, etc.)
- Authorization Header → **"Add Header"**:
  - Key: `Authorization`
  - Value: `Bearer my-secret-webhook-token-2026` (bunu sen belirle, aklında tut)

> Şimdi bu secret'ı Edge Function'a da tanımlaman gerek — bu adımı daha sonra Edge Function deploy ederken yapacağız.

---

## 9. TESTFLIGHT

### 9.1 Minimum Gereksinimler

App Store Connect'te uygulamayı TestFlight'a göndermeden önce şunların eksiksiz olması gerekir:

- [ ] App Information (isim, kategori, yaş sınırı, gizlilik URL'si)
- [ ] Pricing and Availability (Free)
- [ ] En az 1 build yüklenmiş (EAS production build)
- [ ] Gizlilik soruları cevaplanmış (App Privacy → Data Types)

### 9.2 Production Build + Submit

```powershell
# Production iOS build
eas build --platform ios --profile production

# Build bitince App Store Connect'e gönder
eas submit --platform ios
```

Veya manuel: App Store Connect → TestFlight → build'i sürükle-bırak.

### 9.3 Dahili Test

- App Store Connect → **"TestFlight"** → **"Internal Testing"**
- Test kullanıcılarını ekle (kendi email'in, yakın çevre)
- Onlara indirme linki gönder
- 30 gün boyunca 10.000'e kadar beta test kullanıcısı

---

## 10. KONTROL LİSTESİ

### Apple Developer
- [ ] Team ID not alındı
- [ ] App ID `com.groopay.app` oluşturuldu
- [ ] Service ID `com.groopay.app.auth` oluşturuldu
- [ ] Sign In with Apple capability App ID'ye eklendi
- [ ] Sign In .p8 anahtarı oluşturuldu ve indirildi
- [ ] RevenueCat .p8 anahtarı oluşturuldu ve indirildi
- [ ] RevenueCat Key ID + Issuer ID not alındı

### Google Cloud Console
- [ ] Proje oluşturuldu
- [ ] OAuth consent screen yapılandırıldı
- [ ] OAuth Client ID + Secret alındı
- [ ] Redirect URI eklendi: Supabase callback URL

### Supabase
- [ ] Google provider aktif (Client ID + Secret girildi)
- [ ] Apple provider aktif (Service ID + Team ID + Key ID + .p8 içeriği)
- [ ] Redirect URL `groopay://auth/callback` eklendi

### RevenueCat
- [ ] Proje oluşturuldu
- [ ] App Store Connect API anahtarı bağlandı (Issuer ID + Key ID + .p8)
- [ ] Apple App eklendi (Bundle ID + Shared Secret)
- [ ] Entitlements: `user_pro`, `group_pro`
- [ ] Ürünler App Store Connect'ten içe aktarıldı
- [ ] Offering `default` oluşturuldu (Monthly package)
- [ ] API key'ler `.env`'e eklendi
- [ ] Webhook URL'si ayarlandı

### App Store Connect
- [ ] Uygulama kaydı oluşturuldu
- [ ] IAP ürünleri oluşturuldu (User Pro + Group Pro)
- [ ] Shared Secret RevenueCat'e girildi
- [ ] Sandbox tester oluşturuldu
- [ ] App Privacy soruları cevaplandı (gizlilik URL'si olunca)

### EAS / Kod
- [ ] `eas-cli login` yapıldı
- [ ] `eas build:configure` çalıştırıldı
- [ ] `app.json`'da `owner: fatihdisci` doğru
- [ ] `app.json`'da `bundleIdentifier: com.groopay.app` doğru
- [ ] `.env`'de RevenueCat key'leri var
- [ ] `npx tsc --noEmit` temiz
- [ ] İlk dev build alındı

### Test / Yayın
- [ ] Dev build iPhone'a kuruldu
- [ ] Google ile giriş çalışıyor
- [ ] Apple ile giriş çalışıyor
- [ ] RevenueCat sandbox satın alma çalışıyor
- [ ] Production build alındı
- [ ] TestFlight dahili test başlatıldı

---

## EK: DOSYA DİZİNİ

Kritik dosyaların konumları:

```
C:\Users\fatih\groopay\
  keys/
    AuthKey_XXXXXXXXXX.p8          ← Sign In with Apple özel anahtarı
    AppStoreConnect_XXXXXXXXXX.p8  ← RevenueCat IAP özel anahtarı
  .env                             ← Supabase URL/Key + RevenueCat Key'ler
  app.json                         ← Bundle ID, scheme, owner, plugins
  eas.json                         ← Build profilleri
  lib/
    auth/
      AuthContext.tsx              ← signInWithProvider() (Google/Apple)
      types.ts                     ← OAuthProvider tipi
  app/
    (auth)/
      sign-in.tsx                  ← Google + Apple butonları (aktif)
```

---

*Son güncelleme: 2026-06-03 — Faz 8 başlangıç*
