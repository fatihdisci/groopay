# Groopay — Faz 0 İlerleme Planı

> Son güncelleme: 2026-05-29 18:45

## Tamamlanan Adımlar

### 1. ✅ Proje oluşturma
- `npx create-expo-app@latest groopay --template tabs@latest` ile oluşturuldu
- TypeScript (strict), Expo Router

### 2. ✅ Bağımlılıklar
- **Native (expo install):** `@react-native-async-storage/async-storage`, `react-native-url-polyfill`, `expo-localization`, `@expo/vector-icons`
- **JS (npm install):** `@supabase/supabase-js`, `@tanstack/react-query`, `zustand`, `i18next`, `react-i18next`

### 3. ✅ Klasör yapısı (build spec Bölüm 9 ile uyumlu)

> **Not:** İlk kurulumda iç içe `groopay/groopay/` oluşmuştu. Manually düzeltildi — proje kökü artık `C:\Users\fatih\groopay\`. `.git` şu an `groopay/.git` altında. Tüm komutlar `cd C:\Users\fatih\groopay` ile çalıştırılır.

```
C:\Users\fatih\groopay\          # ← proje kökü (package.json burada)
  app/
    index.tsx               # Redirect / → /(tabs)/groups (SORUN 2 fix)
    _layout.tsx             # QueryClientProvider + i18n init + Stack
    (tabs)/
      _layout.tsx           # 3 tab: Gruplar, Aktivite, Hesap (Ionicons + i18n)
      groups.tsx            # placeholder (Ionicons + i18n)
      activity.tsx          # placeholder (Ionicons + i18n)
      account.tsx           # placeholder (Ionicons + i18n)
  lib/
    supabase/client.ts      # Supabase client (AsyncStorage + url polyfill)
    finance/.gitkeep        # boş, Faz 4-5'te dolacak
    i18n/index.ts           # i18next init (tr default, en fallback)
    revenuecat/.gitkeep     # boş, Faz 7'de dolacak
  components/.gitkeep       # boş, paylaşılan UI
  hooks/.gitkeep            # boş, paylaşılan hooks
  constants/theme.ts        # design token'ları
  locales/
    tr.json                 # dolu
    en.json                 # iskelet
  supabase/
    migrations/.gitkeep     # boş, Faz 2
    functions/.gitkeep      # boş, Faz 2
  .env                      # EXPO_PUBLIC_SUPABASE_URL + ANON_KEY (placeholder)
  .env.example              # anahtar isimleri, değerler boş
  CLAUDE.md                 # proje kuralları
  docs/
    groopay-scope.md        # kapsam kararları
    groopay-build-spec.md   # teknik inşa planı
```

### 4. ✅ SDK 54'e düşürme (SORUN 1)
| Paket | Eski (SDK 56) | Yeni (SDK 54) |
|---|---|---|
| expo | ~56.0.7 | ~54.0.0 |
| react | 19.2.3 | 19.1.0 |
| react-native | 0.85.3 | 0.81.5 |
| expo-router | ~56.2.8 | ~6.0.24 |
| expo-constants | ~56.0.16 | ~18.0.13 |
| expo-font | ~56.0.5 | ~14.0.12 |
| expo-linking | ~56.0.13 | ~8.0.12 |
| expo-localization | ~56.0.6 | ~17.0.9 |
| expo-splash-screen | ~56.0.10 | ~31.0.13 |
| expo-status-bar | ~56.0.4 | ~3.0.9 |
| expo-symbols | ~56.0.5 | ~1.0.8 |
| expo-web-browser | ~56.0.5 | ~15.0.11 |
| react-native-reanimated | 4.3.1 | ~4.1.1 |
| react-native-safe-area-context | ~5.7.0 | ~5.6.0 |
| react-native-screens | 4.25.2 | ~4.16.0 |
| react-native-worklets | 0.8.3 | 0.5.1 |
| typescript | ~6.0.3 | ~5.9.2 |
| @types/react | ~19.2.2 | ~19.1.10 |

### 5. ✅ Root route düzeltmesi (SORUN 2)
- `app/index.tsx` oluşturuldu → `<Redirect href="/(tabs)/groups" />`
- Kök rota (/) artık direkt Gruplar sekmesine yönleniyor

### 6. ✅ Template temizliği
- Silinenler: `modal.tsx`, `+html.tsx`, `+not-found.tsx`, `index.tsx` (eski), `two.tsx`, `components/*`, `constants/Colors.ts`
- `.gitignore`'a `.env` eklendi

## Doğrulama Sonuçları

| Kriter | Durum |
|---|---|
| `npx expo start` hatasız başlıyor | ✅ Metro Bundler başladı |
| 3 tab (Gruplar/Aktivite/Hesap) | ✅ Ionicons ikonlu, i18n başlıklı |
| Tab başlıkları i18n'den (Türkçe) | ✅ `t('tabs.groups')` vb. |
| Supabase client import çökmez | ✅ lib/supabase/client.ts hazır |
| `npx tsc --noEmit` | ✅ Sıfır hata |
| `npx expo-doctor` | ✅ 17/18 (tek uyarı: metro.config.js false alarm) |
| / → Gruplar sekmesine yönleniyor | ✅ Redirect çalışıyor |
| **Telefonda Expo Go testi** | ✅ **192.168.1.104:8081 — 3 sekme açıldı** |

### Bağlantı notu
- Metro'yu başlatırken şu komut kullanılacak:
  ```powershell
  $env:REACT_NATIVE_PACKAGER_HOSTNAME="192.168.1.104"
  npx expo start --lan
  ```
- Telefon ve bilgisayar aynı WiFi'de olmalı (IP değişirse `Get-NetIPAddress` ile yeni IP'yi bul)

## BEKLEYEN: Supabase bağlantı bilgileri
`.env` dosyasındaki placeholder'ları gerçek değerlerle değiştir:
```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

## Sıradaki: Faz 1 — Auth + Profil + Onboarding
(Başlamak için onay bekleniyor)
