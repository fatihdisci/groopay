# Groopay — Tasarım Revizyonu

> Başlangıç: 2026-05-31
> Hedef: "Modern fintech" estetiği — güven veren ama insani. Revolut/Monzo soğukluğu değil, Splitwise sıcaklığı değil; ikisinin ortası.
> Durum: Tüm turlar tamamlandı ✅ (Tur 1-5)

---

## Tur 1: Design System Temeli ✅

### 1.1 Fontlar
- **Display/Heading:** Plus Jakarta Sans (600, 700, 800) — `@expo-google-fonts/plus-jakarta-sans`
- **Body/UI:** Inter (400, 500, 600) — `@expo-google-fonts/inter`
- **Kaldırılan:** Poppins (zaten yoktu)
- **Kurulum:** `_layout.tsx` → `useFonts` + `SplashScreen.preventAutoHideAsync/hideAsync`

### 1.2 Design Tokens — `constants/theme.ts`
- **Arka plan:** `#F7F6FF` (off-white mor tonlu, saf beyaz değil)
- **Surface:** `#FFFFFF` (kartlar), `#EFEEFC` (section bg)
- **Primary:** `#4F46E5` (korundu)
- **Borç:** `#F43F5E` (rose, eski `#EF4444` kırmızıdan daha sıcak)
- **Alacak:** `#10B981` (emerald)
- **Uyarı:** `#F59E0B` (amber)
- **Metin:** `#0D0D14` (near-black sıcak), `#6B7280` (secondary), `#9CA3AF` (tertiary)
- **Gölge:** Mor tintli (`#4F46E5`), neutral siyah yerine
- **Spacing:** 4px base grid — `4/8/12/16/20/24/32/40/48/64`
- **Radius:** `8/12/16/20/999` (daha yuvarlak)
- **Gradient:** `#4F46E5 → #7C3AED`
- **Backwards-compat:** `palette`, `spacing`, `fontSizes`, `radii` alias'ları korundu

### 1.3 Shared Styles — `constants/styles.ts` (yeni)
- Kartlar: `card`, `cardTinted`
- Tipografi: `amountLarge/Medium/Small`, `heading1/2/3`, `bodyLarge/body/bodySmall/caption/label`
- Butonlar: `buttonPrimary/Secondary/Destructive`
- Semantik: `creditText`, `debtText`, `primaryText`
- Ayraç: `divider`

### 1.4 Avatar Gradient — `constants/avatarColors.ts` (yeni)
- 8 mevcut renk AYNEN korundu
- Her birine manuel açık-ton gradient çifti eklendi
- `getAvatarGradient(color)` → `[base, light]`
- `AuthContext` artık buradan import ediyor

### 1.5 Paketler
- `expo-font` ✅
- `@expo-google-fonts/plus-jakarta-sans` ✅
- `@expo-google-fonts/inter` ✅
- `expo-linear-gradient` ✅ (avatar gradient)
- `expo-splash-screen` ✅ (zaten vardı)

### 1.6 Gradient Avatarlar — `components/Avatar.tsx` (yeni)
- Reusable `Avatar` bileşeni: `initials`, `color` (base hex → gradient), `ghostColor` (düz renk), `size`
- `LinearGradient` ile 135° açı, `getAvatarGradient` ile renk çifti
- Ghost üyeler: düz muted renk (gradient yok)
- **Uygulanan yerler (5 dosya):**
  - `app/groups/[id]/index.tsx` — grup header avatar + üye chip avatarları
  - `app/groups/[id]/members.tsx` — üye liste avatarları
  - `app/(tabs)/groups.tsx` — grup kart avatarları
  - `app/(tabs)/account.tsx` — profil avatarı
- **Korunanlar:** Balance avatarları (finansal durum rengi — düz View, gradient değil)

### 1.7 Tur 1 Sonrası Durum
- `npx tsc --noEmit`: temiz ✅
- `npx expo start`: açılıyor ✅
- Arka plan `#F7F6FF`, kartlar beyaz, fontlar yüklü
- EKRAN KODUNA DOKUNULMADI (Tur 2-4'te)

---

## Tur 2: Gruplar Ana Ekranı ✅

> Kapsam: `app/(tabs)/groups.tsx` — kullanıcının ilk gördüğü ekran.

### 2.1 Genel Bakiye Özet Kartı (OverallBalanceSummary)
- **Eski:** Beyaz kart, kırmızı/yeşil metinler, border
- **Yeni:** Gradient mor kart (`#4F46E5 → #5B54E8`), `LinearGradient`
- Üstte "GENEL DURUM" etiketi (beyaz, yarı-saydam, letter-spacing)
- Para birimi badge + BÜYÜK BOLD beyaz rakam (`fontDisplayBold, 2xl`) + durum metni
- Alacaklı: rakam hafif yeşilimsi tint (`#D1FAE5`), kart rengi aynı kalır
- `Shadows.lg`, padding 20px, boşsa render edilmez

### 2.2 Grup Kartları
- **Eski:** Avatar + isim + üye sayısı + ok
- **Yeni:** Sol: gradient avatar. Orta: `fontDisplayMedium` başlık + üye sayısı · para birimi (`bodySmall`). Sağ: net bakiye (en fazla 2 para birimi, borç kırmızı/alacak yeşil)
- Per-group bakiye: `useQuery` ile tüm grupların expenses+splits+settlements'ı toplu çekilir, kullanıcının her gruptaki net'i hesaplanır
- Demo badge: sarı pill (`Colors.demo`), ismin yanında (eski sağda ayrıydı)
- Kart: `Colors.surface` beyaz, `Radius.lg`, `Shadows.md`, margin-bottom 8

### 2.3 Yeni Grup FAB
- Gradient arka plan (`Colors.gradientStart → Colors.gradientEnd`), `LinearGradient`
- `Shadows.fab` (mor gölge, elevation 12)
- Limit dolunca gri gradient + kilit

### 2.4 Gruba Katıl Butonu
- `Colors.primaryGhost` arka plan, mor çerçeve, mor metin
- `Radius.md` (12px)

### 2.5 Tab Bar + Header
- `app/(tabs)/_layout.tsx`: header `fontDisplayMedium`, tab bar `Colors.surface`

### 2.6 Boş Durum
- "Henüz grubun yok" (fontDisplayMedium) + "İlk grubu oluştur veya bir davet koduyla katıl!" alt başlık

### 2.7 Değişen Dosyalar
- `app/(tabs)/groups.tsx` — komple yeniden yazıldı (stiller, kartlar, FAB, bakiye kartı)
- `app/(tabs)/_layout.tsx` — tab bar + header font/renk
- `locales/tr.json`, `locales/en.json` — `groups.emptyTitle/emptySubtitle`, `balance.overallStatus`

---

## Tur 3: Grup Detay Sayfası ✅

> Kapsam: `app/groups/[id]/index.tsx` — header, masraf sekmesi, bakiye sekmesi.

### 3.1 Grup Header
- **Eski:** Beyaz kart, border, gölge yok
- **Yeni:** Gradient full-bleed (`gradientArray`, 160°), padding-top 60 (nav altı), beyaz metin
- Avatar 64px, ad `fontDisplayBold xl`, üye/para birimi `fontBody sm` yarı-saydam beyaz

### 3.2 Üyeler Satırı
- Gradient avatarlar (Tur 1), "Üye Ekle" butonu noktalı mor daire + `person-add-outline`

### 3.3 Tab Seçici
- Aktif: `fontBodyBold`, `surfaceTinted` arka plan, `Radius.md`
- Pasif: `fontBody`, `textSecondary`

### 3.4 Pro Özellikler — Collapsed Banner (KRİTİK)
- **Eski:** 4 satırlık dev kutu, masraf listesini eziyor
- **Yeni:** Tek satır collapsed banner: "💎 Pro özellikler" + chevron
- Tıklanınca LayoutAnimation ile açılır, 4 satır görünür
- `surfaceTinted` arka plan, `Radius.sm`, padding 10

### 3.5 Masraf Kartı
- `fontBodyBold` masraf adı, `fontDisplayMedium` tutar
- Kategori ikonu: renkli daire
- Kart: `Shadows.sm`, `Radius.lg`, `Colors.surface`
- Genişlemiş halde "Kapat ↑" collapse butonu (eski "Küçültmek için tekrar dokun" yerine)

### 3.6 Bakiye Sekmesi
- **Self-summary:** Gradient mor kart, "SENİN DURUMUN" etiketi, `fontDisplayBold 3xl` BÜYÜK rakam, alt alta para birimleri
- **Toggle:** Seçili: beyaz `Colors.surface` + `Shadows.sm`, mor metin. Seçisiz: şeffaf, gri
- **RawBalanceList:** Avatar + isim + mutlak tutar (renkli, +/- işareti yok) + durum kelimesi
- **Simplified:** X kırmızı `Colors.debt`, Y yeşil `Colors.credit`, tutar `fontDisplayMedium`
- **Kartlar:** `Colors.surface`, `Shadows.sm`, `Radius.lg`

### 3.7 Aktivite
- Event-type ikonlar: masraf → 🛒, ödeme → ✓, katılım → 👤, silme → 🗑
- Renkler: masraf mor, ödeme yeşil, ret kırmızı, pending amber

### 3.8 FAB
- `Shadows.fab` (mor gölge, elevation 12), gradient yok (zaten extended FAB)

### 3.9 Değişen Dosyalar
- `app/groups/[id]/index.tsx` — header, pro banner, self-summary, expense card, balance rows, activity icons, stiller
- `locales/tr.json`, `locales/en.json` — `expense.closeDetail`

### 3.10 Tur 3 Sonrası Düzeltmeler

**1. Grup kartlarında bakiye özeti kaldırıldı**
- `app/(tabs)/groups.tsx`: Grup kartlarının sağındaki per-group net bakiye kaldırıldı. `groupBalances` query'si silindi, `cardBalance*` stilleri temizlendi.

**2. Header gradient açıldı**
- `app/groups/[id]/index.tsx`: `#4F46E5→#7C3AED` → `#6366F1→#8B5CF6` (daha açık, avatar moruyla kontrast). Self-summary de aynı.

**3. Grup detay + kart meta: para birimi kaldırıldı**
- Header ve kart meta'da `group.base_currency` (TRY) kaldırıldı, sadece üye sayısı.

**4. Pro özellikler banner küçültüldü**
- `components/ProGate.tsx` — `ProFeatureRow`: paddingVertical 16→8, minHeight 44→36, fontSize md→sm, ikon 20→16, `numberOfLines: 1`.
- `app/groups/[id]/index.tsx` — `proBannerBody`: `gap: 6` eklendi (satırlar üst üste binmesin). `headerGradient`: `borderBottomLeftRadius/borderBottomRightRadius: Radius.xl` (alt köşeler oval).

---

---

## Tur 4: Cila Turu ✅

> Kapsam: Onboarding, Aktivite, Hesap, Masraf Ekle, Paywall, Üyeler — kalan tüm ekranlar.

### 4.1 Onboarding (`app/(onboarding)/intro.tsx`)
- Her slide: gradient arka plan (indigo→violet, violet→purple, purple→indigo)
- İkon: 48px beyaz, 100px yarı-saydam beyaz daire arka plan
- Başlık: `fontDisplayBold xl`, beyaz, tight letter-spacing
- Alt metin: `fontBody base`, yarı-saydam beyaz (0.85)
- "İleri" butonu: beyaz dolgu, mor metin — ters kontrast
- "Atla": yarı-saydam beyaz
- Sayfa noktaları: aktif beyaz, pasif yarı-saydam

### 4.2 Aktivite (`app/(tabs)/activity.tsx`)
- Çift "Aktivite" başlığı kaldırıldı (sadece nav title)
- Olay satırları: düz mor nokta → olay tipine göre renkli ikon daire (12px): masraf=primary, ödeme=credit, katılım=violet
- Grup chip: `surfaceTinted` arka plan, `primary` metin, `Radius.full` pill
- Tarih başlıkları: `fontBodyBold`, letter-spacing
- "? hayalet üyesini devraldı" → "bilinmeyen üye" fallback
- `activity.unknownMember` i18n anahtarı eklendi

### 4.3 Hesap (`app/(tabs)/account.tsx`)
- Gradient mini-header: `gradientStart→gradientEnd`, 64px avatar, isim `fontDisplayMedium` beyaz, "Ücretsiz"/"Pro Üye" pill badge
- Header köşeleri: `Radius.xl` (tüm köşeler oval)
- Kaydet butonu: `LinearGradient` dolgu, tam genişlik, `Radius.md`
- Çıkış yap: `debtLight` arka plan, `debt` metin, `Radius.md`

### 4.4 Bakiyeler — Temizleme
- "Ödedim" ve "IBAN İste": kompakt ikon-only butonlar (✓ yeşil daire, 💳 mor daire), tutarın yanında, 30px
- Pending varsa buton yerine "Onay Bekleniyor" badge

### 4.5 Pro Özellikler
- Kilit ikonu kaldırıldı, sadece `ProBadge`
- `ProFeatureRow`: padding/daha küçük, `numberOfLines: 1`, `gap: 6`
- `proBanner`: collapsed banner, tıklanınca LayoutAnimation ile açılır

### 4.6 Header + Grup Kartları
- Grup detay header: `borderRadius: Radius.xl` (tüm köşeler oval)
- Account header: `borderRadius: Radius.xl` (tüm köşeler oval)
- Header gradient: `#6366F1→#8B5CF6` (avatar kontrastı için daha açık)
- Grup kartı meta: `base_currency` (TRY) kaldırıldı, sadece üye sayısı
- Grup kartı: per-group bakiye özeti kaldırıldı, `groupBalances` query'si silindi

### 4.7 Masraf Ekle (`app/groups/[id]/add-expense.tsx`)
- Modal sheet tasarımı — cila
- Başlık "Masraf Ekle": `fontDisplayBold`, `textPrimary`, center
- Tutar input: ÇOK BÜYÜK (`size 4xl`, `fontDisplayBold`, `primary` renk, center). Placeholder "0,00" `textTertiary`. Input çerçevesi yok, sadece alt çizgi (`border-bottom`, `primary`)
- Para birimi chips: seçili = `primary` dolgu + beyaz metin. Pasif = border + `textSecondary`. `Radius.full` (pill)
- Kategori chips: seçili = kategori rengine göre renkli dolgu. Her chip sol ikonu + metin
- Ödeyen chips: seçili = gradient avatar + mor border. Pill shape
- Bölüşme tipi: Eşit/Özel/Alt-Küme — tab görünümünde, seçili altı çizgili `primary`
- Önizleme listesi: avatar + isim + tutar (`fontBodyMedium`). Toggle switch mor
- Kaydet butonu: gradient dolgu (`gradientArray`), tam genişlik, `radius 14`, `fontBodyBold` beyaz

### 4.8 Paywall (`app/paywall.tsx`)
- Header: gradient tam genişlik, elmas ikon beyaz büyük, başlık `fontDisplayBold` beyaz, alt metin yarı-saydam beyaz
- Pro Özellikleri kartı: beyaz, `Radius.lg`, `Shadows.md`. Her satır: sol renkli ikon (`primary` renk — marka tutarlılığı), metin `fontBodyMedium`
- "Bu Grubu Pro Yap" kartı (Önerilen): `primary` border 2px, `surfaceTinted` arka plan. "Önerilen" badge gradient. Satın Al butonu gradient
- "Pro'ya Geç" kartı: beyaz, `Shadows.sm`. Buton koyu primary
- Dev build uyarısı: `warningLight` arka plan, `warning` metin, `radius 8`

### 4.9 Üyeler Modal (`app/groups/[id]/members.tsx`)
- Üstteki iki ikon buton (kişi-ekle, link): etiket eklendi. Sol buton: "Hayalet Ekle" (founder görür, değilse disabled + açıklama). Sağ buton: "Davet Linki". Her biri mor outline, `radius 12`, ikon + metin
- Üye satırları: gradient avatar, isim `fontBodyMedium`, tip (Gerçek üye/Hayalet üye) `bodySmall` `textSecondary`
- Kurucu badge: `primary` pill, beyaz metin, `xs` font

---

## Tur 5: Hesap Sayfası Düzeltmeleri ✅

> Kapsam: `app/(tabs)/account.tsx`, `components/Toast.tsx`, `constants/avatarColors.ts`, locale dosyaları.
> Tarih: 2026-05-31

### 5.1 Kaydet Butonu Düzeltmesi
- **Sorun:** `TouchableOpacity` sadece içerik genişliğinde kalıyordu (tam genişlik değil), `borderRadius: Radius.md + 2` (14px) tutarsızdı
- **Yapılan:** `alignSelf: 'stretch'` eklendi → buton ekran genişliğine yayıldı. `borderRadius: Radius.md` (12px) ile diğer butonlarla tutarlı hale geldi. Gereksiz `alignItems/justifyContent` outer butondan kaldırıldı

### 5.2 Header Arka Planı Dinamik Avatar Rengi
- **Sorun:** Header gradient sabit `#4F46E5→#7C3AED` idi, avatar rengiyle uyumsuzdu. Açık avatar renklerinde (sarı, yeşil, teal) beyaz metin okunmuyordu
- **Yapılan (`constants/avatarColors.ts`):**
  - `darkenHex(hex, factor)` — HSL uzayında koyulaştırma fonksiyonu eklendi
  - `getAvatarHeaderGradient(color)` — `[darkenHex(color, 0.35), color]` gradient çifti döndürür. Beyaz metin her zaman okunur
- **Yapılan (`app/(tabs)/account.tsx`):** Header `LinearGradient` artık `getAvatarHeaderGradient(selectedColor)` kullanıyor. Avatar rengi değişince arka plan da o rengin koyu tonu oluyor

### 5.3 Toast Konumlandırma
- **Sorun 1:** Toast `ScrollView` içinde olduğu için `position: absolute` scroll içeriğine göre konumlanıyor, save butonuna yapışıyordu
- **Sorun 2:** `bottom: 100` alt bara çok uzaktı
- **Yapılan (`app/(tabs)/account.tsx`):** Ekran `View wrapper` → `ScrollView` + `Toast` şeklinde yapılandırıldı. Toast artık ekrana göre konumlanıyor
- **Yapılan (`components/Toast.tsx`):** `bottom: 100` → `bottom: 8` — Toast alt barın hemen üstünde floating olarak çıkıyor

### 5.4 Locale Çeviri Düzeltmesi
- **Sorun:** `locales/tr.json` ve `locales/en.json` dosyalarında `account` key'i **mükerrerdi**. İkinci key ilkini eziyor, `profileSaved` ve `profileSaveError` çevirileri kayboluyordu. Toast'ta ham key (`account.profileSaved`) görünüyordu
- **Yapılan:** İlk `account` bloğu silindi, eksik key'ler (`profileSaved`, `profileSaveError`) ikinci `account` bloğuna eklendi. Her iki locale dosyası da düzeltildi

### 5.5 Değişen Dosyalar
- `app/(tabs)/account.tsx` — saveButton tam genişlik, header dinamik gradient, Toast wrapper dışına taşındı
- `components/Toast.tsx` — `bottom: 100` → `bottom: 8`
- `constants/avatarColors.ts` — `darkenHex()`, `getAvatarHeaderGradient()` eklendi
- `locales/tr.json` — mükerrer `account` key'i temizlendi, eksik çeviriler eklendi
- `locales/en.json` — aynı düzeltme

---

*Son güncelleme: 2026-05-31 — Tur 1-5 tamamlandı*

---

## Tur 6: Gruplar Ekranı + Yeni Grup/Gruba Katıl ✅

> Tarih: 2026-06-02
> Kapsam: `app/(tabs)/groups/index.tsx`, `app/(tabs)/groups/new.tsx`, `app/join/index.tsx`

### 6.1 Yeni Grup Ekranı (`new.tsx`)
- **Gradient hero:** 72px people ikonu daire, "Yeni Grup" başlık, açıklama alt metin. Alt köşeler 24px oval
- **Form:** section label ("GRUP ADI"), TextInput (surfaceTinted bg, radius 12), 0/30 karakter sayacı, ipucu satırı
- **Buton:** Gradient "Oluştur" bottom-sticky (KeyboardAvoidingView), klavye üstünde kalır

### 6.2 Gruba Katıl Ekranı (`join/index.tsx`)
- **Aynı gradient hero:** enter-outline ikonu, "Gruba Katıl" + "Davet kodunu gir"
- **Kod input:** büyük, ortalanmış, letter-spacing 4, fontDisplayMedium, surfaceTinted bg
- **3-adım akış korundu:** enter → preview (ghost claim) → joining
- **Bottom-sticky butonlar:** KeyboardAvoidingView ile

### 6.3 Gruplar Ana Ekranı (`index.tsx`)
- **Modal bottom sheet pattern** — inline panel'lerin yerini aldı:
  - `Modal transparent animationType="slide"`
  - `KeyboardAvoidingView` + `TouchableWithoutFeedback` backdrop
  - Sheet: `Colors.surface`, üst köşeler 24px oval, drag handle, `Shadows.lg`
- **Yeni Grup modal:** Başlık → TextInput (karakter sayacı) → Vazgeç + Gradient Oluştur
- **Gruba Katıl modal:** Başlık → Kod input (letter-spacing 4, centered) → Vazgeç + Gradient Grubu Bul
- **Butonlar:** Alt bar'da yan yana — "Gruba Katıl" outline + "Yeni Grup" gradient
- Pro limiti: reachedLimit ise buton gri + kilit, paywall'a yönlendirir

### 6.4 Değişen Dosyalar
- `app/(tabs)/groups/index.tsx` — Modal bottom sheet + butonlar
- `app/(tabs)/groups/new.tsx` — Gradient hero + bottom-sticky buton
- `app/join/index.tsx` — Gradient hero + bottom-sticky butonlar
- `locales/tr.json`, `locales/en.json` — `groups.*` + `join.*` anahtarları

### 6.5 Diğer Tasarım Değişiklikleri
- **Üye yönetimi (`members.tsx`):** Panel toggle (`activePanel`), unified `panelCard` stili, inline ghost form, zengin üye satırları, modal yerine inline form
- **Hesap (`account.tsx`):** 4 bölüm başlığı (PROFİL/TERCİHLER/ÜYELİK/HESAP), KeyboardAvoidingView + scrollTo onFocus
- **Dashboard (`dashboard.tsx`):** Tüm İşlemler expandable bölüm, ay filtresi, unified effect fix, Modal bottom sheet groups
- **Aktivite (`activity.tsx`):** Metin arama (Pro-gated, tr-TR debounce 300ms)
- **Panel varsayılan sekme:** `app/index.tsx` → `/dashboard` redirect
- **Input letter-spacing:** Tüm form input'larında `-0.2` (hafif sıkılaştırılmış)
