<!--
  ╔══════════════════════════════════════════════════════════════╗
  ║                    🏦  G  R  O  O  P  A  Y                   ║
  ║          Masrafları böl, hesaplar netleşsin.                ║
  ╚══════════════════════════════════════════════════════════════╝
-->

<div align="center">

<img src="assets/images/icon.png" width="120" height="120" alt="Groopay" />

# 🏦 Groopay

### *Masrafları böl, hesaplar netleşsin.*

[![Expo SDK](https://img.shields.io/badge/Expo-54-000?style=for-the-badge&logo=expo&logoColor=white&labelColor=1B1B1F&color=7C3AED)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React_Native-0.81-000?style=for-the-badge&logo=react&logoColor=61DAFB&labelColor=1B1B1F&color=61DAFB)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-000?style=for-the-badge&logo=typescript&logoColor=3178C6&labelColor=1B1B1F&color=3178C6)](https://www.typescriptlang.org)
[![React 19](https://img.shields.io/badge/React-19-000?style=for-the-badge&logo=react&logoColor=61DAFB&labelColor=1B1B1F&color=087EA4)](https://react.dev)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-000?style=for-the-badge&logo=supabase&logoColor=3ECF8E&labelColor=1B1B1F&color=3ECF8E)](https://supabase.com)
[![Vitest](https://img.shields.io/badge/Tests-75/75-000?style=for-the-badge&logo=vitest&logoColor=6E9F18&labelColor=1B1B1F&color=10B981)](https://vitest.dev)

<br />

```
 ┌─────────────────────────────────────────────────────────────┐
 │                                                             │
 │   "Modern fintech" estetiği. Güven veren ama insani.        │
 │   Revolut/Monzo soğukluğu değil, Splitwise sıcaklığı değil —│
 │   ikisinin ortası.                                          │
 │                                                             │
 └─────────────────────────────────────────────────────────────┘
```

<br />

[![Phase](https://img.shields.io/badge/Faz-0→7_tamam,_Faz_8_devam-10B981?style=flat-square&labelColor=1B1B1F)](.)
[![i18n](https://img.shields.io/badge/i18n-TR_|_EN-4F46E5?style=flat-square&labelColor=1B1B1F)](.)
[![Strict](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&labelColor=1B1B1F)](.)
[![License](https://img.shields.io/badge/License-MIT-F43F5E?style=flat-square&labelColor=1B1B1F)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-iOS_|_Android-7C3AED?style=flat-square&labelColor=1B1B1F)](.)

</div>

---

<details open>
<summary><h2>📖 İçindekiler</h2></summary>

- [✨ Neden Groopay?](#-neden-groopay)
- [🏗 Mimari & Teknoloji Yığını](#-mimari--teknoloji-yığını)
- [📐 Tasarım Sistemi](#-tasarım-sistemi)
- [🧠 Finansal Mantık](#-finansal-mantık)
- [🗄 Veritabanı Şeması](#-veritabanı-şeması)
- [🚀 Başlangıç](#-başlangıç)
- [📱 Ekranlar & Özellikler](#-ekranlar--özellikler)
- [🧪 Test Stratejisi](#-test-stratejisi)
- [🔐 Güvenlik](#-güvenlik)
- [💰 Monetizasyon](#-monetizasyon)
- [📂 Proje Yapısı](#-proje-yapısı)
- [🗺 Geliştirme Fazları](#-geliştirme-fazları)
- [🐛 Bugfix Günlüğü](#-bugfix-günlüğü)
- [🎨 Tasarım Revizyonu](#-tasarım-revizyonu)
- [👤 Yazar & Lisans](#-yazar--lisans)

</details>

---

## ✨ Neden Groopay?

> **Problem:** Ev arkadaşları, arkadaş grupları, seyahat ekipleri... Hepsi ortak masraf yapıyor ama kimin kime ne borcu olduğu bir türlü netleşmiyor. Excel? WhatsApp grubu? Hesap makinesi? 2026'dayız.

> **Çözüm:** Groopay — **saniyeler içinde masraf böl, anında net bakiye gör, tek tuşla öde.**

<div align="center">

| 🎯 | Özellik |
|:--:|:--------|
| 🧮 | **Akıllı Bölüşme** — Eşit, özel, alt-küme. Kalan kuruş ödeyene. |
| 🌍 | **Çoklu Para Birimi** — Her masraf kendi biriminde. Çapraz kur çevrimi canlı (Frankfurter API). |
| ⚡ | **Gerçek Zamanlı** — Supabase Realtime. Masraf eklenince herkes anında görür. |
| 🔢 | **Kuruş Tabanlı** — ASLA float. Tüm hesaplar integer minor units. Hassas. |
| 🤖 | **En Az İşlemle Netleşme** — Graph algoritması. Gereksiz ödemeleri ele. |
| 🔐 | **IBAN Saklanmaz** — Sunucuda ASLA. Realtime broadcast ile anlık iletilir, uçar. |
| 👻 | **Hayalet Üyeler** — Gruba ekle, sonradan hesap açınca geçmişi devralsın. |
| 🔒 | **Row-Level Security** — PostgreSQL RLS. Her kullanıcı sadece kendi gruplarını görür. |
| 💎 | **Panel & Pro** — 4. sekme genel bakiye + kategori analizi. Pro ile sınırsız grup. |

</div>

---

## 🏗 Mimari & Teknoloji Yığını

<div align="center">

```
┌──────────────────────────────────────────────────────────┐
│                     📱 CLIENT (Expo)                      │
│  ┌──────────┐ ┌───────────┐ ┌────────┐ ┌─────────────┐  │
│  │  React   │ │ TanStack  │ │ i18next│ │  RevenueCat  │  │
│  │ Native   │ │  Query v5 │ │ (tr|en)│ │    (IAP)     │  │
│  │  0.81    │ │  Cache    │ │        │ │              │  │
│  └──────────┘ └───────────┘ └────────┘ └─────────────┘  │
│  ┌──────────────────────────────────────────────────────┐ │
│  │              lib/finance  (PURE + tested)            │ │
│  │  money.ts │ split.ts │ fx.ts │ balance.ts │ simplify │ │
│  │                75 birim test ✅                       │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────┬───────────────────────────────────┘
                       │  Supabase JS Client
                       ▼
┌──────────────────────────────────────────────────────────┐
│                   🗄 SUPABASE BACKEND                     │
│  ┌─────────────────┐ ┌──────────┐ ┌────────────────────┐ │
│  │   PostgreSQL     │ │   RLS    │ │     Realtime       │ │
│  │   8 tablo        │ │ Policies │ │  (WebSocket)       │ │
│  └─────────────────┘ └──────────┘ └────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐ │
│  │                Edge Functions (Deno)                  │ │
│  │  join-via-invite │ send-push │ revenuecat-webhook    │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

</div>

<table>
<tr>
<th width="140">Katman</th>
<th>Teknoloji</th>
<th>Neden?</th>
</tr>

<tr>
<td><b>Framework</b></td>
<td>
  <img src="https://img.shields.io/badge/Expo_SDK-54-000?style=flat-square&logo=expo&logoColor=white&color=7C3AED" />
  <img src="https://img.shields.io/badge/React_Native-0.81-000?style=flat-square&logo=react&color=61DAFB" />
  <img src="https://img.shields.io/badge/React-19-000?style=flat-square&logo=react&color=087EA4" />
</td>
<td>Cross-platform (iOS + Android). Expo Router ile file-based routing. Expo Go ile anında test.</td>
</tr>

<tr>
<td><b>Dil</b></td>
<td>
  <img src="https://img.shields.io/badge/TypeScript-5.9_strict-000?style=flat-square&logo=typescript&color=3178C6" />
</td>
<td>Sıfır <code>any</code>. Explicit return types. <code>strict: true</code>. Derleme zamanında hata yakalama.</td>
</tr>

<tr>
<td><b>State & Cache</b></td>
<td>
  <img src="https://img.shields.io/badge/TanStack_Query-v5-000?style=flat-square&logo=reactquery&logoColor=FF4154&color=FF4154" />
  <img src="https://img.shields.io/badge/Zustand-v5-000?style=flat-square&color=433E3F" />
</td>
<td>Server state → React Query cache (auto-invalidation). Client state → Zustand.</td>
</tr>

<tr>
<td><b>Backend</b></td>
<td>
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-000?style=flat-square&logo=supabase&logoColor=3ECF8E&color=3ECF8E" />
  <img src="https://img.shields.io/badge/Edge_Functions-Deno-000?style=flat-square&logo=deno&color=000" />
</td>
<td>PostgreSQL + RLS + Realtime + Edge Functions + Anonymous Auth. Hepsi tek platformda.</td>
</tr>

<tr>
<td><b>İletişim</b></td>
<td>
  <img src="https://img.shields.io/badge/REST-API-000?style=flat-square&color=10B981" />
  <img src="https://img.shields.io/badge/WebSocket-Realtime-000?style=flat-square&color=F59E0B" />
  <img src="https://img.shields.io/badge/RPC-Stored_Procedures-000?style=flat-square&color=EC4899" />
</td>
<td>Supabase JS Client → otomatik REST. Realtime channel → canlı masraf/bakiye. RPC → kompleks transaction'lar.</td>
</tr>

<tr>
<td><b>Animasyon</b></td>
<td>
  <img src="https://img.shields.io/badge/React_Native_Reanimated-4.1-000?style=flat-square&color=0284C7" />
  <img src="https://img.shields.io/badge/LayoutAnimation-Native-000?style=flat-square&color=7C3AED" />
</td>
<td>60fps native thread animasyonlar. Spring fizik tabanlı geçişler. Pro banner genişleme, FAB fade-out.</td>
</tr>

<tr>
<td><b>Font</b></td>
<td>
  <img src="https://img.shields.io/badge/Plus_Jakarta_Sans-Display-000?style=flat-square&color=4F46E5" />
  <img src="https://img.shields.io/badge/Inter-Body/UI-000?style=flat-square&color=6B7280" />
</td>
<td>Stripe/Mercury seviyesi fintech tipografisi. Para rakamları için optimize. <code>useFonts</code> + <code>SplashScreen</code>.</td>
</tr>

<tr>
<td><b>Uluslararasılaşma</b></td>
<td>
  <img src="https://img.shields.io/badge/i18next-v26-000?style=flat-square&logo=i18next&logoColor=26A69A&color=26A69A" />
</td>
<td>Türkçe varsayılan, İngilizce fallback. <code>toLocaleUpperCase('tr-TR')</code> ile İ/Ş/Ü/Ğ koruması. 200+ çeviri anahtarı.</td>
</tr>

<tr>
<td><b>Monetizasyon</b></td>
<td>
  <img src="https://img.shields.io/badge/RevenueCat-IAP-000?style=flat-square&color=7C3AED" />
</td>
<td>User Pro (aylık). RevenueCat IAP. Webhook → sunucu tarafı entitlement. Expo Go'da zarif fallback.</td>
</tr>

<tr>
<td><b>Test</b></td>
<td>
  <img src="https://img.shields.io/badge/Vitest-75_test-000?style=flat-square&logo=vitest&logoColor=6E9F18&color=10B981" />
</td>
<td>Tüm finansal fonksiyonlar PURE. Her fonksiyonun birim testi var. <code>npx vitest run</code> → 75/75 ✅</td>
</tr>
</table>

---

## 📐 Tasarım Sistemi

> **Design System v2.0** — Modern fintech: açık zemin, gradient aksanlar, bold typography.

<table>
<tr>
<th width="120">Kategori</th>
<th>Token</th>
<th>Değer</th>
</tr>

<tr>
<td><b>Arka Plan</b></td>
<td>

`Colors.background`
`Colors.backgroundSecondary`

</td>
<td>

`#F7F6FF` — off-white mor tonlu, saf beyaz değil
`#EFEEFC` — section ayırıcı

</td>
</tr>

<tr>
<td><b>Primary</b></td>
<td>

`Colors.primary`
`Colors.gradientArray`

</td>
<td>

`#4F46E5` — Groopay moru
`['#4F46E5', '#7C3AED']` — 135° gradient

</td>
</tr>

<tr>
<td><b>Finansal</b></td>
<td>

`Colors.credit`
`Colors.debt`
`Colors.warning`

</td>
<td>

`#10B981` — emerald (alacak)
`#F43F5E` — rose (borç)
`#F59E0B` — amber (pending)

</td>
</tr>

<tr>
<td><b>Metin</b></td>
<td>

`Colors.textPrimary`
`Colors.textSecondary`
`Colors.textTertiary`

</td>
<td>

`#0D0D14` — near-black sıcak
`#6B7280` — ikincil
`#9CA3AF` — placeholder

</td>
</tr>

<tr>
<td><b>Tipografi</b></td>
<td colspan="2">

```jsx
fontDisplay:    'PlusJakartaSans_700Bold'       // başlıklar, büyük tutarlar
fontDisplayBold:'PlusJakartaSans_800ExtraBold'   // hero rakamlar
fontBody:       'Inter_400Regular'               // normal metin
fontBodyBold:   'Inter_600SemiBold'              // bold metin
```

</td>
</tr>

<tr>
<td><b>Gölge</b></td>
<td colspan="2">

```jsx
Shadows.sm  = { shadowColor: '#4F46E5', elevation: 2  }  // mor tintli!
Shadows.md  = { shadowColor: '#4F46E5', elevation: 4  }
Shadows.lg  = { shadowColor: '#4F46E5', elevation: 8  }
Shadows.fab = { shadowColor: '#4F46E5', elevation: 12 }  // FAB özel
```

> ⚠️ Tüm gölgeler mor tintli (`#4F46E5`) — neutral siyah yerine brand rengi.

</td>
</tr>

<tr>
<td><b>Spacing</b></td>
<td colspan="2">4px base grid → `4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64`</td>
</tr>

<tr>
<td><b>Radius</b></td>
<td colspan="2">`8 / 12 / 16 / 20 / 999` (full pill)</td>
</tr>

<tr>
<td><b>Animasyon</b></td>
<td colspan="2">

```jsx
Animation = { fast: 150, normal: 250, slow: 350, spring: { damping: 15, stiffness: 150 } }
```

</td>
</tr>
</table>

### 🎨 Avatar Gradient Sistemi

```typescript
// 8 renk, manuel seçilmiş açık-ton çiftleriyle
AVATAR_GRADIENTS = {
  '#6C5CE7': ['#6C5CE7', '#A29BFE'],  // mor
  '#00B894': ['#00B894', '#55EFC4'],  // yeşil
  '#E17055': ['#E17055', '#FAB1A0'],  // mercan
  '#0984E3': ['#0984E3', '#74B9FF'],  // mavi
  '#FDCB6E': ['#FDCB6E', '#FFEAA7'],  // sarı
  '#E84393': ['#E84393', '#FD79A8'],  // pembe
  '#00CEC9': ['#00CEC9', '#81ECEC'],  // teal
  '#D63031': ['#D63031', '#FF7675'],  // kırmızı
}

// Dynamic header: darkenHex(hex, 0.35) → beyaz metin her zaman okunur
getAvatarHeaderGradient(selectedColor) → [koyuTon, base]
```

---

## 🧠 Finansal Mantık

> **Kutsal kurallar.** Bunları ihlal eden PR direkt reddedilir.

<table>
<tr><th>#</th><th>Kural</th><th>Açıklama</th></tr>

<tr>
<td>1</td>
<td><b>ASLA float</b></td>
<td>

Tüm hesaplamalar **integer kuruş** cinsinden. `toMinor(19.99, 'TRY') → 1999`. `toMajor(1999, 'TRY') → "19,99"`. `parseNumericInput("19.99") → 1999`.

</td>
</tr>

<tr>
<td>2</td>
<td><b>Orijinal para birimi</b></td>
<td>Masraf hangi birimdeyse öyle saklanır. ASLA çevrilip saklanmaz. `amount: 100, currency: 'USD'` sonsuza kadar böyle kalır.</td>
</tr>

<tr>
<td>3</td>
<td><b>Bakiye TÜRETİLİR</b></td>
<td>`balance = sum(expense_splits) - sum(confirmed_settlements)`. Her seferinde sıfırdan hesaplanır. Cache'lenmez, saklanmaz.</td>
</tr>

<tr>
<td>4</td>
<td><b>Para birimleri KARIŞMAZ</b></td>
<td>TRY borç + USD borç = ❌ ANLAMSIZ. Her bakiye para birimi BAZINDA ayrı ayrı gösterilir.</td>
</tr>

<tr>
<td>5</td>
<td><b>Kur çevrimi SADECE GÖRÜNTÜLEME</b></td>
<td>Kullanıcı "TRY karşılığı" toggle'lar → Frankfurter API → "≈ X TRY (bugünkü kur, bilgi amaçlı)". Bu değer ASLA kaydedilmez.</td>
</tr>

<tr>
<td>6</td>
<td><b>Kalan kuruş ödeyene</b></td>
<td>Eşit bölüşmede bölünemeyen kuruş, masrafı ödeyen kişiye eklenir.</td>
</tr>

<tr>
<td>7</td>
<td><b>Pending ≠ Balance</b></td>
<td>Onay bekleyen ödemeler bakiyeyi ETKİLEMEZ. Sadece `confirmed` settlement'lar hesaba katılır.</td>
</tr>
</table>

### 🧮 Borç Sadeleştirme Algoritması

```
SimplifiedBalanceList:
  6 kişi, 15 masraf, 3 para birimi
  ┌──────────────────────────────────┐
  │  TRY: Ali → Ayşe: 45,50 ₺       │
  │  TRY: Mehmet → Ali: 12,00 ₺     │
  │  USD: Ayşe → Mehmet: $8.50      │
  │  EUR: Ali → Zeynep: €22.00      │
  └──────────────────────────────────┘
  En az işlemle tüm borçlar kapanır ↑
```

> **Algoritma:** `simplifyDebts(nets[])` — net pozisyonları hesapla → greedy eşleştirme → en az sayıda transfer. Kuruş yuvarlama toleransı: `|total| ≤ 2` → dağıt, `> 2` → exception.

---

## 🗄 Veritabanı Şeması

<div align="center">

```
┌──────────┐     ┌───────────────┐     ┌──────────────┐
│ profiles │────→│ group_members │←────│    groups    │
│          │     │  (hybrid!)    │     │              │
│ user_pro │     │  user_id=NULL │     │   is_pro     │
│ avatar   │     │  is_active    │     │   is_demo    │
│ locale   │     │  role         │     │   base_curr  │
└──────────┘     └──────┬────────┘     └──────────────┘
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
   ┌──────────┐  ┌────────────┐  ┌──────────────┐
   │ expenses │  │ settlements │  │ group_invites│
   │          │  │             │  │              │
   │ amount   │  │ amount      │  │  token       │
   │ currency │  │ currency    │  │  expires     │
   │ deleted  │  │ status      │  └──────────────┘
   └────┬─────┘  └─────────────┘
        │
        ▼
 ┌──────────────┐     ┌──────────────┐
 │expense_splits│     │ activity_log │
 │              │     │              │
 │ share_amount │     │  event_type  │
 │ member_id    │     │  metadata    │
 └──────────────┘     └──────────────┘
```

</div>

### 🧩 Hibrit Üye Modeli (KRİTİK)

```
Ghost member:  group_members (user_id = NULL, display_name = "Ali")
               ↓  Ali hesap açıp bu profili "sahiplenince"
Real member:   AYNI satır, user_id SET edilir (yeni row DEĞİL)
               ↓  sonuç: geçmiş masraflar, bakiye — her şey korunur
```

### 🔐 RLS (Row-Level Security)

```sql
-- Recursion'ı önleyen SECURITY DEFINER fonksiyon
CREATE OR REPLACE FUNCTION is_member_of(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = p_group_id
      AND user_id = auth.uid()
      AND is_active = true
  );
$$;

-- Tüm tablolarda:
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view expenses"
  ON expenses FOR SELECT
  USING (is_member_of(group_id));
```

---

## 🚀 Başlangıç

```bash
# 1. Repo'yu klonla
git clone https://github.com/fatihdisci/groopay.git
cd groopay

# 2. Bağımlılıkları yükle
npm install

# 3. .env dosyasını oluştur
cp .env.example .env
# → Supabase URL + anon key'i .env'e gir

# 4. Supabase migration'ları çalıştır
# supabase CLI ile: supabase migration up
# VEYA SQL dosyalarını supabase dashboard → SQL Editor'da sırayla çalıştır
# (supabase/migrations/0001..0008)

# 5. Başlat! 🚀
npx expo start --tunnel --clear

# 6. Testleri çalıştır
npm test        # vitest run (75 test)
npx tsc --noEmit  # TypeScript kontrolü
```

<details>
<summary><b>📱 Expo Go ile test (telefon)</b></summary>

```bash
npx expo start --tunnel --clear
# → QR kodu telefonun kamerasıyla tara (iOS) veya
#   Expo Go uygulamasından tara (Android)
# → "Test kullanıcısı olarak gir" ile anonim giriş
```

</details>

<details>
<summary><b>🔧 Supabase ayarları</b></summary>

Supabase Dashboard'da şunları aç:
- **Authentication** → **Anonymous Sign-ins:** AÇIK
- **Realtime** → Tüm tablolara publication ekle
- **Edge Functions** → `join-via-invite` deploy et
- `.env`:
  ```
  EXPO_PUBLIC_SUPABASE_URL=<your-project-url>
  EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
  EXPO_PUBLIC_REVENUECAT_APPLE_KEY=  (opsiyonel, Faz 8)
  EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY= (opsiyonel, Faz 8)
  ```

</details>

---

## 📱 Ekranlar & Özellikler

<table>
<tr><th>Ekran</th><th>Route</th><th>Öne Çıkanlar</th></tr>

<tr>
<td>🏠 <b>Gruplar</b></td>
<td><code>/(tabs)/groups</code></td>
<td>

- Grup kartları: gradient/emoji avatar + üye sayısı
- Alt bar: "Gruba Katıl" + "+ Yeni Grup" yan yana
- 5-grup limiti → paywall yönlendirme
- Demo grup badge, Pro rozeti

</td>
</tr>

<tr>
<td>📈 <b>Panel</b></td>
<td><code>/(tabs)/dashboard</code></td>
<td>

- 4. sekme, herkese açık
- Gradient hero: para birimi bazında genel bakiye (alacak/borç)
- Para birimi seçici: TRY, EUR, USD — her biri ayrı gösterilir
- Temel istatistikler: grup/masraf sayısı, en aktif grup
- Kategori dağılımı (herkese açık, seçili para biriminde)
- Free: blur'lu Pro önizleme (trend + detaylı analiz)
- Pro: SimpleBarChart trend grafiği (View-based, SVG yok) + insight kartları (en hareketli ay, popüler kategori, en çok ödeyen, borç/alacak özeti)

</td>
</tr>

<tr>
<td>📊 <b>Aktivite</b></td>
<td><code>/(tabs)/activity</code></td>
<td>

- Tarihe göre gruplanmış olay akışı
- Olay tipine göre renkli ikon daireler
- Grup adı rozeti
- Supabase Realtime → canlı güncelleme

</td>
</tr>

<tr>
<td>👤 <b>Hesap</b></td>
<td><code>/(tabs)/account</code></td>
<td>

- Dinamik gradient header (avatar rengine göre)
- Avatar renk seçici (8 renk, gradient önizleme)
- Pro durum kartı + DEV Pro toggle
- Hesap silme (çift onay + SİL yazma)
- Veri dışa aktarma (JSON)
- Dil seçimi (TR/EN)

</td>
</tr>

<tr>
<td>📋 <b>Grup Detay</b></td>
<td><code>/groups/[id]</code></td>
<td>

- Custom gradient header (#6366F1 → #8B5CF6) + geri/düzenle/tips butonları
- Emoji/renk avatar + açıklama + üye sayısı
- Hızlı üye chips + üye ekleme
- Masraflar/Bakiyeler tab seçici
- Masraf kartı: 3 satırlı layout, kategori filtreleme, TRY karşılığı toggle
- Genişleyebilir kartlar (not + split detay)
- Bakiyeler: self-summary, sadeleştirilmiş/ham mod, ödeme onaylama, IBAN iste/paylaş
- ? yardım butonu (TipsModal)

</td>
</tr>

<tr>
<td>✏️ <b>Grubu Düzenle</b></td>
<td><code>/groups/[id]/edit</code></td>
<td>

- Ad, açıklama, avatar rengi, emoji (16 seçenek)
- Canlı header önizleme + "DÜZENLEME MODU"
- Kurucu devri + gruptan ayrılma
- Grubu sil (hard delete, cascade)

</td>
</tr>

<tr>
<td>➕ <b>Masraf Ekle</b></td>
<td><code>/groups/[id]/add-expense</code></td>
<td>

- Wise-style numpad (View-based, 48px bold, sadece tutar girerken)
- Para birimi pill seçici (TRY, EUR, USD + 20 diğer)
- Kategori chips (6 kategori, renk kodlu)
- Bölüşme tipi: Eşit / Özel / Alt-Küme — canlı önizleme
- Genişletilebilir detaylar (not, tarih)
- Düzenleme modu: mevcut masrafı düzenleme
- ? yardım butonu (TipsModal)

</td>
</tr>

<tr>
<td>👥 <b>Üyeler</b></td>
<td><code>/groups/[id]/members</code></td>
<td>

- Founder/normal üye yetki ayrımı + açıklamalar
- Hayalet üye ekleme (founder only)
- Gruptan ayrılma (RPC tabanlı)
- Davet kodu oluşturma + paylaşma
- Claim: hayalet profili sahiplenme
- ? yardım butonu

</td>
</tr>

<tr>
<td>💎 <b>Paywall</b></td>
<td><code>/paywall</code></td>
<td>

- Modern fintech: açık feature row'lar, soft shadow
- Sadece User Pro (aylık), canlı fiyat
- Restore purchases (Apple zorunlu)
- X kapatma butonu

</td>
</tr>

<tr>
<td>🚀 <b>Onboarding</b></td>
<td><code>/(onboarding)/intro</code></td>
<td>

- 3 slide, her biri farklı gradient arka plan
- Beyaz dolgu buton, ters kontrast
- Sayfa noktaları

</td>
</tr>

<tr>
<td>🔗 <b>Katılma</b></td>
<td><code>/join/[token]</code></td>
<td>

- Deep link: `groopay://join/ABC123`
- Edge Function: claim + ghost eşleştirme
- Otomatik üyelik + aktivite log

</td>
</tr>
</table>

---

## 🧪 Test Stratejisi

<div align="center">

```
lib/finance/
├── money.test.ts        ✅ 18 test
├── split.test.ts        ✅ 22 test
├── balance.test.ts      ✅ 20 test
└── simplify.test.ts     ✅ 15 test
─────────────────────────────────
     Toplam:             75/75 ✅
```

</div>

```typescript
// Örnek: money.test.ts
describe('toMinor', () => {
  it('converts TRY string to kuruş', () => {
    expect(toMinor('19.99', 'TRY')).toBe(1999)
  })
  it('handles comma decimal separator', () => {
    expect(toMinor('19,99', 'TRY')).toBe(1999)
  })
  it('rejects floats via parseNumericInput', () => {
    expect(parseNumericInput('19.99')).toBe(1999)
    expect(parseNumericInput('19,99')).toBe(1999)
  })
})

describe('parseNumericInput', () => {
  it('strips non-numeric characters', () => {
    expect(parseNumericInput('50050050')).toBe(50050050)
    expect(parseNumericInput('₺100')).toBe(10000)
  })
})
```

> **Felsefe:** Tüm finansal fonksiyonlar **PURE** + **test edilmiş**. Hiçbir side effect yok. Her edge case düşünüldü. Para birimi hassasiyeti, kuruş yuvarlama, sıfır, negatif.

---

## 🔐 Güvenlik

<table>
<tr><th>Katman</th><th>Mekanizma</th></tr>

<tr>
<td>🏰 <b>Row-Level Security</b></td>
<td>

PostgreSQL RLS. Her tabloda `is_member_of(group_id)` policy'si. Kullanıcı sadece üyesi olduğu grupların verilerini görebilir.

</td>
</tr>

<tr>
<td>🔑 <b>Anonymous Auth</b></td>
<td>Supabase Anonymous Sign-In. Test kullanıcısı anında giriş yapar. Faz 8'de Google + Apple OAuth eklenecek.</td>
</tr>

<tr>
<td>🛡 <b>SECURITY DEFINER</b></td>
<td>

`is_member_of()` fonksiyonu `SECURITY DEFINER` — RLS recursion tuzağını önler.

</td>
</tr>

<tr>
<td>🚫 <b>IBAN Saklanmaz</b></td>
<td>

IBAN **hiçbir tabloda KALICI SAKLANMAZ**. Realtime broadcast channel ile anlık iletilir, alıcı kopyalar, sinyal uçar. Supabase'de IBAN kalıntısı yok.

</td>
</tr>

<tr>
<td>💳 <b>Entitlement Sunucuda</b></td>
<td>RevenueCat webhook → `profiles.user_pro` / `groups.is_pro`. Client entitlement'a GÜVENMEZ, sunucudan okur.</td>
</tr>

<tr>
<td>🌐 <b>Edge Function Auth</b></td>
<td>Her Edge Function `Authorization: Bearer <secret>` header'ı ile gelir. Service-role key sunucuda, client'ta DEĞİL.</td>
</tr>
</table>

---

## 💰 Monetizasyon

```
Client (RevenueCat SDK)
  └── User Pro → aylık abonelik, tüm gruplar + sınırsız grup + panel + kategori analizi

Webhook (revenuecat-webhook)
  └── INITIAL_PURCHASE → profiles.user_pro = true

Pro Kontrol Zinciri:
  hasProAccess() = user_pro
  ├── True  → Panel'de tüm bölümler açık, sınırsız grup
  └── False → Panel'de kilitli önizleme (blur), 5 grup limiti
```

> **Not:** Grup Pro şimdilik kaldırıldı. Sadece User Pro (aylık) aktif. Kod altyapısı duruyor, ileride eklenebilir.

| Özellik | Free | User Pro |
|:--------|:----:|:--------:|
| Grup oluşturma | 5 max | **Sınırsız** |
| Masraf ekleme | ✅ | ✅ |
| Bakiye & Netleşme | ✅ | ✅ |
| IBAN iste/paylaş | ✅ | ✅ |
| Panel (genel bakiye) | ✅ | ✅ |
| Kategori analizi | ✅ | ✅ |
| Panel kilitli bölümler | 🔒 blur | ✅ açık |
| Harcama trendi | 🔒 blur | 🔜 Yakında |

---

## 📂 Proje Yapısı

```
groopay/
├── app/                              # Expo Router (file-based routing)
│   ├── _layout.tsx                   # Root: QueryClient + Auth + RevenueCat + Font
│   ├── index.tsx                     # Auth gate (yönlendirme)
│   ├── paywall.tsx                   # Pro satın alma ekranı
│   ├── (auth)/                       # Giriş ekranı
│   │   └── sign-in.tsx
│   ├── (onboarding)/                 # Onboarding turu (3 slide)
│   │   └── intro.tsx
│   ├── (tabs)/                       # Ana sekmeler
│   │   ├── _layout.tsx               # Tab navigator (Panel · Gruplar · Aktivite · Hesap)
│   │   ├── dashboard.tsx             # Panel (hero + stats + kategori + Pro trend/analiz)
│   │   ├── activity.tsx              # Tüm gruplar aktivite akışı
│   │   ├── account.tsx               # Hesap / Profil / Pro / Silme
│   │   └── groups/
│   │       ├── _layout.tsx           # Stack: index → [id] → add-expense → members → edit → new
│   │       ├── index.tsx             # Grup listesi + genel bakiye + join/new
│   │       ├── new.tsx               # Yeni grup oluştur
│   │       └── [id]/
│   │           ├── index.tsx          # Grup detay (masraf/bakiye sekmeleri, FAB)
│   │           ├── add-expense.tsx    # Masraf ekle/düzenle (Wise numpad, split, tarih)
│   │           ├── members.tsx        # Üye yönetimi (hayalet, davet, claim)
│   │           └── edit.tsx           # Grubu düzenle (ad, renk, emoji, sil, ayrıl, devret)
│   └── join/                         # Kodla katılma + deep link
│       ├── index.tsx
│       └── [token].tsx
│
├── components/                       # Paylaşılan bileşenler
│   ├── Avatar.tsx                    # Gradient/emoji avatar (LinearGradient)
│   ├── Toast.tsx                     # Toast bildirim (animasyonlu)
│   ├── TabBarButton.tsx             # Animasyonlu tab bar butonu (Reanimated)
│   ├── Animations.tsx               # FadeInUp + ScaleOnPress
│   ├── TipsButton.tsx + TipsModal.tsx # ? yardım popup'ları
│
├── constants/                        # Design System
│   ├── theme.ts                      # Colors, Typography, Spacing, Radius, Shadows
│   ├── styles.ts                     # Shared styles (kart, buton, tipografi)
│   └── avatarColors.ts              # Avatar gradient sistemi + darkenHex
│
├── hooks/                            # Custom hooks
│   ├── useGroups.ts                  # Grup listesi
│   ├── useGroupDetail.ts            # Grup detay
│   ├── useExpenses.ts               # Masraf CRUD
│   ├── useBalance.ts                # Bakiye hesaplama
│   ├── useFxRate.ts                 # Canlı kur
│   ├── useSettlements.ts            # Netleşme
│   ├── useRealtime.ts               # Supabase Realtime
│   └── usePro.ts                    # Pro erişim kontrolü
│
├── lib/
│   ├── auth/                         # AuthContext + useAuth
│   ├── supabase/                     # client, types, queries
│   ├── finance/                      # 🧮 SAF FONKSİYONLAR (hepsi testli)
│   │   ├── money.ts                  #   toMinor, fromMinor, formatAmount, getDecimals
│   │   ├── split.ts                  #   splitEqual, splitCustom, splitSubset
│   │   ├── fx.ts                     #   fetchFxRate (Frankfurter API)
│   │   ├── balance.ts               #   computeBalances (türetilmiş)
│   │   ├── simplify.ts              #   simplifyDebts (graph algorithm)
│   │   ├── categories.ts            #   Kategori tanımları
│   │   └── __tests__/               #   75 birim test ✅
│   ├── i18n/                         # i18next yapılandırması
│   ├── notifications/               # Push notification yardımcıları
│   └── revenuecat/                   # RevenueCat SDK wrapper
│
├── locales/                          # Çeviri dosyaları
│   ├── tr.json                       # Türkçe (varsayılan)
│   └── en.json                       # İngilizce (fallback)
│
├── supabase/
│   ├── migrations/                   # 8 migration dosyası
│   │   ├── 0001_initial_schema.sql   #   8 tablo + RLS + trigger
│   │   ├── 0002_invite_preview_rpc.sql
│   │   ├── 0003_ghost_preview_rpc.sql
│   │   ├── 0004_drop_fx_columns_add_expense_rpc.sql
│   │   ├── 0005_realtime_publication.sql
│   │   ├── 0006_settlements_currency_iban.sql
│   │   ├── 0007_group_management.sql #   Grup yönetimi RPC'leri
│   │   └── 0008_preferred_currency.sql #  Varsayılan para birimi
│   └── functions/                    # Edge Functions (Deno)
│       ├── join-via-invite/          #   Davetle katılım
│       ├── send-push/                #   Push bildirimi
│       ├── revenuecat-webhook/       #   RevenueCat → DB
│       └── delete-account/           #   Hesap silme (Apple zorunlu)
│
├── assets/                           # İkon, splash, font
├── docs/                             # Scope + Build Spec
├── FAZ0-PLAN.md ... FAZ7-PLAN.md     # Faz planları
├── SESSION-OZET.md                   # Oturum özeti
├── BUGFIX-CILA.md                    # Bugfix günlüğü (B1-B64)
├── TASARIM-REVIZYON.md              # Tasarım revizyonu (Tur 1-5)
├── CLAUDE.md                         # Proje kuralları
├── package.json
├── tsconfig.json                     # TypeScript strict
└── app.json                          # Expo yapılandırması
```

---

## 🗺 Geliştirme Fazları

```
Faz 0  ████████████  Proje iskeleti + Design System    ✅
Faz 1A ████████████  Anonim auth + Profil + Onboarding ✅
Faz 2  ████████████  Veritabanı şeması + RLS           ✅
Faz 3  ████████████  Grup CRUD + Hayalet üye + Davet   ✅
Faz 4  ████████████  Masraf + Bölüşme + Çoklu birim    ✅
Faz 5  ████████████  Bakiye + Sadeleştirme + Realtime  ✅
Faz 6  ████████████  Netleşme + IBAN + Push            ✅
Faz 7  ████████████  Monetizasyon + Paywall            ✅
Faz 8  ░░░░░░░░░░░░  Store-hazırlık + OAuth + Cila     ⏳
```

---

## 🐛 Bugfix Günlüğü

<details open>
<summary><b>64 bugfix, 15 tur — hepsi kapandı ✅</b></summary>

| Tur | ID'ler | Konular |
|:---:|:-------|:--------|
| 1 | B1-B6 | Aktivite metinleri, butonlar, uppercase, toast, avatar rengi, i18n |
| 2 | B7-B12 | FAB'lar, üye sayısı, limit, masraf kartı genişleme |
| 3 | B13-B18 | Settlement metni, FAB yazısı, buton düzeni, kuruş crash |
| 4 | B19-B24 | Pro sadeleştirme (Grup Pro kaldırıldı), paywall gerçekleştirme |
| 5 | B25-B31 | Grup yönetimi (düzenleme, silme, üye çıkarma, kurucu devri) |
| 6 | B32-B35 | Route yapısı, header/geri butonu, avatar emoji |
| 7 | B36 | Alt bar tasarımı + animasyonlar + header çizgisi |
| 8 | B37-B43 | Hesap silme, dashboard 4. sekme, tips popup'ları, butonlar, paywall |
| 9 | B44-B46 | Pro dashboard analitiği, header mimarisi (gradient, butonlar) |
| 10 | B47-B53 | Add-expense regresyon: split, para birimi, önizleme, düzenleme, tarih, numpad |
| 11 | B54-B56 | Dashboard para birimi karışması (trend, kategori, çapraz çevrim) |
| 12 | B57 | Dashboard para birimi seçici + profil varsayılan para birimi |
| 13 | B58-B62 | Detaylı analiz (topPayer, settlementSummary), header butonları, tab bar |
| 14 | B63 | Para formatı tutarsızlığı — `formatAmount()` ile tr-TR formatı her yerde |
| 15 | B64 | Masraf kartı layout: 3 satır, tutar sağda sabit, uzun metin taşmaz |

</details>

---

## 🎨 Tasarım Revizyonu

<details open>
<summary><b>9 tur, modern fintech estetiği ✅</b></summary>

| Tur | Kapsam | Durum |
|:---:|:-------|:-----:|
| 1 | Design system temeli (font, token, avatar gradient) | ✅ |
| 2 | Gruplar ana ekranı (bakiye kartı, kartlar, FAB) | ✅ |
| 3 | Grup detay (header, masraf, bakiye, pro banner) | ✅ |
| 4 | Cila (onboarding, aktivite, hesap, paywall, üyeler) | ✅ |
| 5 | Hesap düzeltmeleri (buton, header dinamik, toast) | ✅ |
| 6 | Pro sadeleştirme + dashboard 4. sekme + blur önizleme | ✅ |
| 7 | Tab bar animasyonu + header tutarlılığı | ✅ |
| 8 | Paywall modern fintech + X kapatma + fiyat gösterme | ✅ |
| 9 | Masraf kartı 3-satır layout + para formatı tr-TR standardı | ✅ |

</details>

---

<div align="center">

## ⚡ Hızlı İstatistikler

<table>
<tr>
<td align="center"><b>80+</b><br><sub>dosya</sub></td>
<td align="center"><b>12.000+</b><br><sub>satır kod</sub></td>
<td align="center"><b>90+</b><br><sub>commit</sub></td>
<td align="center"><b>75</b><br><sub>test (✅)</sub></td>
<td align="center"><b>250+</b><br><sub>i18n anahtarı</sub></td>
<td align="center"><b>8</b><br><sub>veritabanı tablosu</sub></td>
<td align="center"><b>8</b><br><sub>migration</sub></td>
<td align="center"><b>4</b><br><sub>Edge Function</sub></td>
</tr>
</table>

<br />

---

<br />

```
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🏦  Groopay — Masrafları böl, hesaplar netleşsin.         ║
║                                                              ║
║   Built with ❤️  using Expo + Supabase + TypeScript          ║
║                                                              ║
║   © 2026 fatihdisci. MIT License.                            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

<br />

[![Star](https://img.shields.io/badge/⭐_Star_this_repo-if_you_like_it!-F59E0B?style=for-the-badge&labelColor=1B1B1F)](https://github.com/fatihdisci/groopay)

</div>
