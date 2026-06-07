# Groopay — Bugfix & Cila Günlüğü

> Oturum: 2026-05-31
> Bağlam: Faz 8 öncesi bugfix turu
> tsc: ✅ temiz

---

## Tamamlananlar (1. Tur — 6 hata)

### ✅ B1: Aktivite akışında ham event type metinleri (KRİTİK)

**Sorun:** `settlement_confirmed`, `settlement_marked`, `member_claimed` gibi teknik string'ler kullanıcıya ham gösteriliyordu.

**Yapılan:**
- `app/(tabs)/activity.tsx` ve `app/groups/[id]/index.tsx` — `formatActivity` fonksiyonuna `settlement_confirmed`, `settlement_marked`, `settlement_rejected`, `member_claimed` case'leri eklendi. Default case artık ham string dönmüyor, fallback i18n anahtarı kullanıyor.
- `locales/tr.json`, `locales/en.json` — `activity.settlement_confirmed`, `activity.settlement_marked`, `activity.settlement_rejected`, `activity.member_claimed`, `activity.genericActivity` anahtarları eklendi.
- Metadata'dan isim, tutar, para birimi bilgileri çekilip metne gömülüyor.

**Değişen dosyalar:** `app/(tabs)/activity.tsx`, `app/groups/[id]/index.tsx`, `locales/tr.json`, `locales/en.json`

---

### ✅ B2: Bakiyeler sekmesindeki "Ödedim" ve IBAN butonları

**Sorun:** Butonlar dar, IBAN sadece ikon, ne işe yaradığı anlaşılmıyor. Pending durumda borçlu tekrar "Ödedim" basabiliyor.

**Yapılan:**
- "Ödedim" butonu: mor dolgu (`palette.primary`), `minHeight: 44`, `minWidth: 72`, yeterli padding.
- "IBAN İste" butonu: outline stil (mor çerçeve), kart ikonu + metin birlikte, `minHeight: 44`.
- Pending settlement varsa "Onay Bekleniyor" badge'i (sarı/turuncu) gösteriliyor, borçlu tekrar basamıyor.
- `SimplifiedBalanceList` bileşenine `settlements` prop'u eklendi, pending kontrolü yapılıyor.
- `locales/tr.json`, `locales/en.json` — `settle.awaitingApproval` anahtarı eklendi.

**Değişen dosyalar:** `app/groups/[id]/index.tsx`, `locales/tr.json`, `locales/en.json`

---

### ✅ B3: Büyük harf Türkçe karakter sorunu

**Sorun:** `textTransform: 'uppercase'` ve `.toUpperCase()` Türkçe karakterleri bozuyordu (İ→I, Ş→S, Ü→U, Ğ→G).

**Yapılan:**
- Tüm `getInitials` fonksiyonları (4 dosya): `.toUpperCase()` → `.toLocaleUpperCase('tr-TR')`.
- Tüm `textTransform: 'uppercase'` stil özellikleri kaldırıldı (7 yer).
- Bu stilleri kullanan tüm Text bileşenlerine render anında `.toLocaleUpperCase('tr-TR')` uygulandı.
- Etkilenen stiller: `sectionTitle`, `selfSummaryTitle`, `pendingTitle`, `dateLabel`, `label`, `sectionLabel`.

**Değişen dosyalar:** `app/groups/[id]/index.tsx`, `app/groups/[id]/members.tsx`, `app/(tabs)/groups.tsx`, `app/(tabs)/activity.tsx`, `app/(tabs)/account.tsx`

---

### ✅ B4: Profil kaydedince sistem bildirimi yerine toast

**Sorun:** Profil kaydetme başarısı `Alert.alert` ile gösteriliyordu, iOS bildirimi gibi duruyordu.

**Yapılan:**
- `components/Toast.tsx` — Yeni reusable toast bileşeni:
  - Ekranın altında, animasyonlu (slide-up + fade), 2.5 sn otomatik kapanır.
  - `success` (yeşil), `error` (kırmızı), `info` (mor) tipleri.
  - İkon + mesaj, `minHeight: 48`, gölge.
- `app/(tabs)/account.tsx` — `handleSaveProfile`:
  - Başarılı → yeşil toast: "Profil güncellendi ✓"
  - Başarısız → kırmızı toast: "Güncelleme başarısız"
  - Try/catch eklendi (önceden yoktu).
- `locales/tr.json`, `locales/en.json` — `account.profileSaved`, `account.profileSaveError` anahtarları eklendi.

**Değişen dosyalar:** `components/Toast.tsx` (yeni), `app/(tabs)/account.tsx`, `locales/tr.json`, `locales/en.json`

---

### ✅ B5: Profilde seçilen avatar rengi gruplara yansımıyor

**Sorun:** Hesap'ta avatar rengi değiştirilince grup detayındaki ve üyeler sayfasındaki üye avatarları hâlâ eski renkteydi (hatta hep `palette.primary` gösteriliyordu).

**Kök neden (2 parça):**
1. `getGroupDetail` ve `getMyGroups`, `profiles.avatar_color`'ı hiç çekmiyordu — tüm gerçek kullanıcılara `palette.primary` atanıyordu.
2. Profil güncellenince grup sorguları invalidate edilmiyordu.

**Yapılan:**
- `lib/supabase/queries.ts` — `getGroupDetail` ve `getMyGroups` artık üyelerin `profiles.avatar_color`'ını çekip `memberAvatarColors: Record<string, string>` olarak dönüyor.
- `lib/supabase/types.ts` — `GroupWithMembers` interface'ine `memberAvatarColors` eklendi.
- `app/groups/[id]/index.tsx` — Üye chip'leri artık `data.memberAvatarColors[m.user_id]` rengini kullanıyor (fallback: `palette.primary`).
- `app/groups/[id]/members.tsx` — Aynı düzeltme.
- `app/(tabs)/account.tsx` — `handleSaveProfile` sonrası `queryClient.invalidateQueries({ queryKey: ['group'] })` ve `['groups']` çağrıları eklendi.

**Değişen dosyalar:** `lib/supabase/queries.ts`, `lib/supabase/types.ts`, `app/groups/[id]/index.tsx`, `app/groups/[id]/members.tsx`, `app/(tabs)/account.tsx`

---

### ✅ B6: Aktivite akışında teknik isimler + genel tarama

**Sorun:** HATA 1'e ek olarak, uygulama genelinde sert kodlanmış Türkçe/İngilizce hata mesajları kullanıcıya gösteriliyordu.

**Yapılan:**
- `app/groups/[id]/members.tsx` — Tüm `Alert.alert` çağrıları i18n'e taşındı (+ `useTranslation` eklendi):
  - "Üye eklenemedi" → `t('members.addFailed')`
  - "Kendinizi çıkaramazsınız" → `t('members.removeSelf')`
  - "En az bir kurucu kalmalı" → `t('members.removeLastFounder')`
  - Üye çıkarma diyaloğu → `t('members.removeTitle')`, `t('members.removeConfirm')`
  - "Davet oluşturulamadı" → `t('members.inviteFailed')`
- `app/paywall.tsx` — "Grup bilgisi eksik" → `t('paywall.missingGroup')`
- `app/groups/[id]/index.tsx` — "IBAN paylaşıldı ✓" → `t('iban.shared')`, "Üyelik bulunamadı" → `t('settle.memberNotFound')`, hata mesajları → `t('settle.errorTitle')` / `t('settle.unknownError')`
- `locales/tr.json`, `locales/en.json` — `members.errorTitle`, `members.warning`, `members.addFailed`, `members.removeTitle`, `members.inviteFailed`, `settle.errorTitle`, `settle.unknownError`, `settle.memberNotFound`, `iban.shared`, `paywall.missingGroup` anahtarları eklendi.
- Aktivite metinlerinde aktör `display_name` tam adı kullanılıyor (kısaltma yok). Grup chip'i doğru görünüyor.

**Değişen dosyalar:** `app/groups/[id]/members.tsx`, `app/paywall.tsx`, `app/groups/[id]/index.tsx`, `locales/tr.json`, `locales/en.json`

---

## Tamamlananlar (2. Tur — 6 UI/UX sorunu)

### ✅ B7: Masraf ekleme FAB butonu (SORUN 1)

**Sorun:** Sağ üstteki küçük "+" ikonu ne işe yaradığı belli değildi.

**Yapılan:**
- Extended FAB: "+" ikonu + "Masraf Ekle" yazısı birlikte.
- `minHeight: 52`, yatay padding 20px, primary mor, beyaz metin.
- Gölge (elevation 8, shadow).
- Sadece Masraflar sekmesinde görünür, Bakiyeler sekmesine geçince fade-out + scale-down animasyonu (spring).
- Eski `addBtn` ve `expenseHeader` stilleri kaldırıldı.

**Değişen dosyalar:** `app/groups/[id]/index.tsx`, `locales/tr.json`, `locales/en.json`

**Nasıl test edersin:** Grup detay → Masraflar sekmesi → Sağ altta "+ Masraf Ekle" FAB'ı. Bakiyeler sekmesine geç → FAB kaybolur (animasyonlu).

---

### ✅ B8: Gruplar listesinde üye sayısı yanlış (SORUN 2)

**Sorun:** 3 aktif üyeli grup "2 üye" gösteriyordu. `members.length` tüm üyeleri (aktif + eski) sayıyordu.

**Yapılan:**
- Grup detay başlığı: `members.filter(m => m.is_active).length`
- Gruplar listesi kartı: `item.members.filter(m => m.is_active).length`
- İki yerde de aynı filtre, tutarlı sayım.

**Değişen dosyalar:** `app/groups/[id]/index.tsx`, `app/(tabs)/groups.tsx`

**Nasıl test edersin:** 3 aktif üyeli gruba gir → başlıkta "3 üye" yazmalı. Eski üyeler sayıma dahil değil.

---

### ✅ B9: Grup oluşturma butonu belirsiz (SORUN 3)

**Sorun:** "+" ikonlu FAB ne işe yaradığı belli değildi.

**Yapılan:**
- Extended FAB: "+ Yeni Grup" (ikon + yazı).
- Limite yakın (4/5): FAB üstünde sarı "1 hakkın kaldı" badge'i.
- Limit dolunca (5/5): FAB gri, kilit ikonu + "Pro ile sınırsız" yazısı, tıklayınca paywall.
- Yeni stiller: `fabTouchable`, `fabTouchableLocked`, `fabNearLimitBadge`.

**Değişen dosyalar:** `app/(tabs)/groups.tsx`, `locales/tr.json`, `locales/en.json`

**Nasıl test edersin:** Gruplar sekmesi → Sağ altta "+ Yeni Grup" FAB'ı. 4 grup oluştur → "1 hakkın kaldı" badge'i. 5 grup → kilitli FAB.

---

### ✅ B10: Üye ekleme butonunda "Düzenle" yazıyor (SORUN 4)

**Sorun:** Üye chip'inde noktalı çerçeveli "+" butonun altında "Düzenle" yazıyordu.

**Yapılan:**
- Metin: "Düzenle" → "Üye Ekle" (`t('groupDetail.addMember')`).
- İkon: `add` → `person-add-outline`.
- Yönlendirme mantığı aynı kaldı.

**Değişen dosyalar:** `app/groups/[id]/index.tsx`, `locales/tr.json`, `locales/en.json`

**Nasıl test edersin:** Grup detay → Üye chip'leri sonundaki butonda "Üye Ekle" ve kişi+artı ikonu.

---

### ✅ B11: Kurucu vs. üye yetkileri UI'da belirsiz (SORUN 5)

**Sorun:** Founder hayalet üye ekleyebilir, normal üye ekleyemez — bu fark belli değildi. Sabit metinler vardı.

**Yapılan:**
- Founder ise: "Hayalet Üye Ekle" butonu aktif + "Davet Et" butonu (açıklamalı).
- Normal üye ise: "Hayalet Üye Ekle" butonu disabled (gri, opak) + "Hayalet üye ekleme yetkisi yalnızca grup kurucusuna aittir." açıklaması. "Davet Et" butonu aktif + "Davet kodunu paylaşarak kişileri gruba davet edebilirsiniz." açıklaması.
- Founder rozeti: üye listesinde kurucunun yanında "Kurucu" etiketi (zaten vardı, i18n'e taşındı).
- Tüm sabit metinler i18n'e taşındı (modal, invite box, member subtypes).

**Değişen dosyalar:** `app/groups/[id]/members.tsx`, `locales/tr.json`, `locales/en.json`

**Nasıl test edersin:** Founder olarak üye yönetimine gir → iki buton da aktif. Normal üye olarak gir → "Hayalet Üye Ekle" disabled + açıklama var. Founder'ın yanında "Kurucu" rozeti.

---

### ✅ B12: Genişleyebilir masraf kartı (SORUN 6)

**Sorun:** Masraf notları hiç görünmüyordu, split detayı sınırlıydı.

**Yapılan:**
- Masraf kartı tıklanınca `LayoutAnimation` ile genişler/daralır.
- **Kapalı:** Kategori ikonu, masraf adı, ödeyen·tarih, tutar, düzenle/sil, split chip'leri (ilk 3, +N), not varsa 📝 ikonu,chevron.
- **Açık:** Not kutusu (açık gri arka plan, italik), tam split listesi (her üye ayrı satır), "Küçültmek için tekrar dokun" ipucu.
- Aynı anda birden fazla kart açık olabilir.

**Değişen dosyalar:** `app/groups/[id]/index.tsx`, `locales/tr.json`, `locales/en.json`

**Nasıl test edersin:** Masraf kartına dokun → genişler, not ve split detayı görünür. Tekrar dokun → kapanır. Notu olmayan masrafta not kutusu gösterilmez.

---

*Son güncelleme: 2026-05-31 — 2. tur tamamlandı (B7-B12)*

## Genel Kurallar (tüm bugfix'ler için)

- tsc temiz olsun.
- Her düzeltme sonrası ne değiştiği madde madde yazılsın.
- i18n: yeni metinler `tr.json` + `en.json`'a eklensin.
- ui-ux-pro-max: 44px dokunma hedefi, yeterli kontrast.
- Test için: her hata için nasıl test edileceği belirtilsin.

---

### ✅ B13: Aktivite settlement metninde "?" ve yanlış metin (3. Tur)

**Sorun:** "Rubidi, ? kişisine ödemesini onayladı" — `?` çıkıyordu ve metin anlamsızdı.

**Kök neden:** `confirm_settlement` RPC'si activity_log metadata'ya sadece `settlement_id` yazıyordu. `formatActivity` ise `meta.to_member` değerini çözmeye çalışıp bulamayınca `'?'` gösteriyordu.

**Yapılan:**
- `settlement_confirmed`: metin `"{{name}}, {{to}} kişisine {{amt}} {{cur}} ödemesini onayladı"` → `"{{name}} ödemeyi onayladı"` (metadata'da sadece `settlement_id` var, kişi bilgisi yok).
- `settlement_rejected`: metin `"{{name}}, {{to}} kişisine ödemeyi reddetti"` → `"{{name}} ödemeyi reddetti"`.
- İki `formatActivity` fonksiyonu da güncellendi (tabs/activity.tsx + groups/[id]/index.tsx).
- 4 i18n anahtarı güncellendi (tr + en).

**Değişen dosyalar:** `app/(tabs)/activity.tsx`, `app/groups/[id]/index.tsx`, `locales/tr.json`, `locales/en.json`

---

### ✅ B14: FAB metinlerinden "+" kaldırıldı (3. Tur)

**Sorun:** FAB ikonunda "+" vardı, metinde de "+" vardı — çift "+" görünüyordu.

**Yapılan:**
- `locales/tr.json`: `"addExpenseFab": "Masraf Ekle"`, `"createFab": "Yeni Grup"`
- `locales/en.json`: `"addExpenseFab": "Add Expense"`, `"createFab": "New Group"`

---

### ✅ B15: FAB yazı boyutu büyütüldü (3. Tur)

**Yapılan:** `fabLabel.fontSize`: `fontSizes.md` → `fontSizes.lg` (iki dosyada).

**Değişen dosyalar:** `app/groups/[id]/index.tsx`, `app/(tabs)/groups.tsx`

---

### ✅ B16: Butonlar alt satıra alındı + küçültüldü (3. Tur)

**Sorun:** "Ödedim" ve "IBAN İste" butonları tutarın yanında yatay dizili, taşıyordu.

**Yapılan:**
- `SimplifiedBalanceList` yeniden yapılandırıldı: üst satır `simplifiedTopRow` (isimler+tutar), alt satır `simplifiedActions` (butonlar).
- Buton boyutları küçültüldü: `minHeight: 44→38`, `paddingVertical: sm→8`, `fontSize: sm→xs`, `minWidth: 72→64`, ikon `14→12`.

**Değişen dosyalar:** `app/groups/[id]/index.tsx`

---

### ✅ B17: Masraf kartı kapalı halde split gizlendi (3. Tur)

**Sorun:** Kapalı masraf kartında split chip'leri gereksizdi — genişleyince zaten gösteriliyor.

**Yapılan:** `ExpenseCard` kapalı halinde split chip'leri kaldırıldı. Sadece genişleyince split detayı görünür.

**Değişen dosyalar:** `app/groups/[id]/index.tsx`
---

### ✅ B18: simplifyDebts kuruş yuvarlama crash'i

**Sorun:** `simplifyDebts: sum of nets must be 0, got -2` hatasıyla uygulama crash oluyordu. `computeBalances` → `toMinor` → `Math.round` zincirinde 2 kuruşluk yuvarlama hatası oluşuyor, `simplifyDebts` katı `total !== 0` kontrolüyle exception fırlatıyordu.

**Yapılan:** `simplifyDebts` fonksiyonuna tolerans eklendi: `Math.abs(total) ≤ 2` ise kalan kuruş en büyük alacaklıya/borçluya dağıtılıp devam edilir, crash olmaz. `> 2` ise hâlâ exception (gerçek veri hatası).

**Değişen dosyalar:** `lib/finance/simplify.ts`

---

*Son güncelleme: 2026-05-31 — B19-B24 eklendi (Pro sadeleştirme)*

---

## Pro Modeli Sadeleştirme (4. Tur — 6 değişiklik)

> Tarih: 2026-05-31
> Amaç: İki Pro tipi (Grup Pro + User Pro) kullanıcıyı kafalıyordu. Paywall'da çalışmayan 4 özellik vaat ediliyordu. TEK Pro (aylık User Pro) modeline geçildi.

### ✅ B19: Grup Pro arayüzden kaldırıldı

**Sorun:** Paywall'da iki Pro seçeneği (Grup Pro + User Pro) kafa karıştırıyordu. Grup Pro tek seferlik, User Pro aylık — ikisi arasındaki fark net değildi.

**Yapılan:**
- `app/paywall.tsx` — "Bu Grubu Pro Yap" kartı TAMAMEN kaldırıldı. Tek "Pro'ya Geç" (User Pro) kartı kaldı, her zaman vurgulu (primary border). "aylık" badge'i eklendi.
- `hooks/usePro.ts` — `hasProAccess` artık sadece `isUserPro` kontrol ediyor. `isGroupPro` fonksiyonu kodda duruyor ama UI'da kullanılmıyor.
- Grup detayındaki Grup Pro referansları kaldırıldı.
- **ÖNEMLİ:** `purchaseGroupPro` fonksiyonu, `handlePurchaseGroupPro` handler'ı ve webhook'taki `group_pro` mantığı KODDA KALDI (ileride lazım olabilir). Sadece ARAYÜZDEN gizlendi.

**Değişen dosyalar:** `app/paywall.tsx`, `hooks/usePro.ts`

---

### ✅ B20: Paywall özellik listesi gerçekçileştirildi

**Sorun:** Paywall'da 5 özellik vaat ediliyordu — Fiş/OCR, Tekrarlayan masraf, PDF/CSV dışa aktarma, Gelişmiş grafikler, Sınırsız grup. Bunlardan 4'ü YAZILMAMIŞTI. Apple bunu reddeder.

**Yapılan:**
- `PRO_FEATURES` listesi 3 çalışan özelliğe indirildi:
  1. "Tüm gruplarını tek panelde gör" (Dashboard) — `stats-chart-outline`
  2. "Sınırsız grup oluştur" — `add-circle-outline`
  3. "Kategori bazlı analiz ve özet" — `pie-chart-outline`
- İkonlar yeşil (`palette.success`) → mor (`palette.primary`) — marka tutarlılığı.
- `paywall.subtitle`: "Tüm özellikleri aç" → "Tüm gruplarını tek yerden yönet, sınırsız grup oluştur."

**Değişen dosyalar:** `app/paywall.tsx`, `locales/tr.json`, `locales/en.json`

---

### ✅ B21: Grup detayı Pro banner kaldırıldı

**Sorun:** Masraf sekmesindeki collapsed "Pro özellikler" banner'ı (Fiş/OCR, Tekrarlayan, Dışa Aktarma, Grafikler) artık vaat edilmeyen özellikleri gösteriyordu. Masraf listesini gereksiz yere sıkıştırıyordu.

**Yapılan:**
- Pro banner JSX bloğu (`proBanner`, `proBannerHeader`, `proBannerBody`) tamamen kaldırıldı.
- `ProFeatureRow`, `ProBadge` import'ları kaldırıldı.
- `proBannerOpen` state'i kaldırıldı.
- Pro banner stilleri (`proBanner*`, 5 stil) temizlendi.
- Masraf listesi artık temiz, banner yok.

**Değişen dosyalar:** `app/groups/[id]/index.tsx`

---

### ✅ B22: Dashboard "Trendler" placeholder'ı kaldırıldı

**Sorun:** Dashboard'da "Trendler: Yakında" placeholder'ı vardı. Çalışmayan bir özellik gösteriliyordu.

**Yapılan:**
- "Trendler" section'ı tamamen kaldırıldı.
- `comingSoonCard`, `comingSoonText` stilleri temizlendi.
- `t('dashboard.comingSoon')` → `t('balance.empty')` (boş kategori durumu için).
- Dashboard artık sadece çalışan 2 bölüm: Genel Bakiye + Kategori Dağılımı.

**Değişen dosyalar:** `app/dashboard.tsx`

---

### ✅ B23: DEV-only Pro toggle butonu eklendi

**Sorun:** Expo Go'da RevenueCat IAP çalışmadığı için Pro ekranlarını (Dashboard, sınırsız grup) test etmek imkansızdı.

**Yapılan:**
- `app/(tabs)/account.tsx` — Çıkış yap butonunun altına, SADECE `__DEV__` modunda görünen buton eklendi: "🛠 [DEV] Pro'yu Aç/Kapat".
- `handleDevTogglePro`: `supabase.from('profiles').update({ user_pro: newVal })` ile DB'ye yazar, sonra `supabase.auth.refreshSession()` + `queryClient.invalidateQueries` ile state'i yeniler.
- Buton stili: kesik çizgili warning renkli çerçeve, sarımsı arka plan — production'da ASLA görünmez.

**Değişen dosyalar:** `app/(tabs)/account.tsx`

---

### ✅ B24: i18n temizliği

**Sorun:** Kaldırılan özelliklere ait i18n anahtarları (`paywall.features.receipt`, `paywall.groupProTitle`, `pro.lockedMessage` vs.) gereksiz yer kaplıyordu.

**Yapılan:**
- `tr.json` + `en.json` — KALDIRILAN anahtarlar:
  - `paywall.features.receipt`, `paywall.features.recurring`, `paywall.features.export`, `paywall.features.charts`
  - `paywall.groupProTitle`, `paywall.groupProDesc`, `paywall.groupProDetail`, `paywall.purchaseGroupPro`, `paywall.groupProSuccess`
  - `pro.lockedMessage`, `pro.groupProBadge`
  - `dashboard.trends`, `dashboard.comingSoon`
- EKLENEN anahtarlar (tr + en):
  - `paywall.features.dashboard`, `paywall.features.categoryAnalytics`
  - `paywall.monthly`
- GÜNCELLENEN anahtarlar:
  - `paywall.subtitle`, `paywall.userProDesc`, `paywall.userProDetail`
  - `paywall.features.unlimitedGroups`

**Değişen dosyalar:** `locales/tr.json`, `locales/en.json`

---

## Sonuç

| Kontrol | Durum |
|---|---|
| `npx tsc --noEmit` | ✅ Temiz |
| Paywall'da tek Pro seçeneği | ✅ Sadece User Pro (aylık) |
| Boş vaat (yazılmamış özellik) | ✅ 0 |
| Grup detay Pro banner | ✅ Kaldırıldı |
| Dashboard placeholder | ✅ Kaldırıldı |
| DEV Pro toggle | ✅ Sadece `__DEV__` |
| Grup Pro altyapısı | ✅ Kodda duruyor, UI'da gizli |

*Son güncelleme: 2026-05-31 — B19-B24 eklendi (Pro sadeleştirme)*

---

## Grup Yönetim Özellikleri (5. Tur — B25-B31)

> Tarih: 2026-05-31
> Migration: `0007_group_management.sql`

### ✅ B25: Migration — 3 sütun + 3 RPC
- `groups` → `description`, `avatar_emoji`, `avatar_color`
- `delete_group(group_id)` — kurucu hard delete + cascade
- `remove_member(group_id, member_id)` — kurucu herkesi / üye kendini
- `transfer_ownership(group_id, new_founder_id)` — kurucu devri
- **Dosya:** `supabase/migrations/0007_group_management.sql`

### ✅ B26: Grup düzenleme ekranı (`app/groups/[id]/edit.tsx`)
- Ad, açıklama, avatar rengi (8), emoji (16), Kaydet
- Gruptan Ayrıl (normal/kurucu akışı), Grubu Sil (kurucu)
- **Dosyalar:** `edit.tsx` (yeni), `_layout.tsx`

### ✅ B27: Avatar emoji desteği
- `Avatar` bileşenine `emoji` prop'u eklendi
- **Dosyalar:** `components/Avatar.tsx`, `index.tsx`, `groups.tsx`

### ✅ B28: Açıklama gösterimi
- Header'da yarı-saydam beyaz metin
- **Dosya:** `app/groups/[id]/index.tsx`

### ✅ B29: Edit butonu
- `navigation.setOptions({ headerRight })` — sadece kurucu
- **Dosya:** `app/groups/[id]/index.tsx`

### ✅ B30: RPC tabanlı üye çıkarma
- `useRemoveMember` → `remove_member` RPC
- Normal üye için "Gruptan Ayrıl" butonu
- **Dosyalar:** `members.tsx`, `hooks/useGroupDetail.ts`

### ✅ B31: i18n + tipler
- `GroupRow`: description, avatar_emoji, avatar_color
- `group.*` namespace (12 anahtar tr+en)
- `deleteGroupRpc`, `removeMemberRpc`, `transferOwnershipRpc`
- **Dosyalar:** `types.ts`, `queries.ts`, `hooks/*`, `locales/*`

| Kontrol | Durum |
|---|---|
| `npx tsc --noEmit` | ✅ Temiz |
| Grup düzenleme | ✅ Ad, açıklama, renk, emoji |
| Emoji avatar | ✅ Grup detay + liste |
| Açıklama | ✅ Header'da görünür |
| Üye çıkarma | ✅ RPC + yetki kontrolü |
| Kurucu devri | ✅ Seç → devret → ayrıl |
| Grup silme | ✅ Hard delete + cascade |

*Son güncelleme: 2026-05-31 — B25-B31 eklendi (grup yönetimi)*

---

## B32: Route + hooks düzeltmesi (5. Tur sonrası)

> Tarih: 2026-05-31

**Sorun 1:** `WARN: No route named "groups/[id]/edit"` — `_layout.tsx`'te edit route'u tanımlı değildi.

**Yapılan:** `app/groups/[id]/_layout.tsx` → edit Stack.Screen eklendi. Root `_layout.tsx`'ten mükerrer tanım kaldırıldı.

**Sorun 2:** `ERROR: Rendered more hooks than during the previous render` — `useEffect` early return sonrasında çağrılıyordu. `isLoading=true` iken atlanıyor, false olunca fazladan hook ekleniyordu.

**Yapılan:** `useEffect` + `navigation.setOptions` kaldırıldı. Edit butonu doğrudan gradient header JSX içine `position: absolute` ile yerleştirildi (sadece `isFounder` ise). Ayrıca `edit.tsx`'teki hatalı `useState` initialization → `useRef` + `useEffect` ile düzeltildi.

**Değişen dosyalar:** `app/groups/[id]/_layout.tsx`, `app/_layout.tsx`, `app/groups/[id]/index.tsx`, `app/groups/[id]/edit.tsx`

*Son güncelleme: 2026-05-31 — B35 eklendi*

---

## B33-B35: Grup detayı tabs içine taşıma + header/geri butonu (6. Tur)

### ✅ B33: Rota yapısı — tabs içine taşıma

**Sorun:** Grup detayı root Stack'te tabs DIŞINDAYDI → alt bar kayboluyordu. Ayrıca root Stack `headerShown: false` nedeniyle header/geri butonu da yoktu. Nested `_layout.tsx` edit route'unu tanımıyordu.

**Yapılan:**
- Tüm grup detay dosyaları `app/groups/[id]/` → `app/(tabs)/groups/[id]/` taşındı
- `app/(tabs)/groups.tsx` → `app/(tabs)/groups/index.tsx`
- `app/(tabs)/groups/_layout.tsx` — Stack layout (liste → detay → modal'lar)
- Root `_layout.tsx`'ten `groups/[id]` kaldırıldı
- Eski `app/groups/[id]/` dizini silindi
- `[id]/index` screen: `headerShown: false, animation: 'none'` (Stack header yok)
- `[id]/edit` screen: `headerShown: false, animation: 'none'`
- Geri butonları gradient header içine `position: absolute, top: 8, left: 8` ile yerleştirildi

**Değişen dosyalar:** `app/(tabs)/groups/_layout.tsx` (yeni), `app/(tabs)/groups/index.tsx` (taşındı), `app/(tabs)/groups/[id]/index.tsx` (taşındı), `app/(tabs)/groups/[id]/edit.tsx` (taşındı), `app/(tabs)/groups/[id]/add-expense.tsx` (taşındı), `app/(tabs)/groups/[id]/members.tsx` (taşındı), `app/_layout.tsx`, eski `app/groups/[id]/` silindi, eski `app/(tabs)/groups.tsx` silindi

### ✅ B34: Avatar emoji görünmezliği + header fontu

**Sorun:** `fontSize: 0` emoji'yi görünmez yapıyordu. Header `fontFamily` eksikti. Avatar'da emoji ile harf arasında font farkı yoktu.

**Yapılan:**
- `components/Avatar.tsx`: emoji → `fontSize: size * 0.52` (sistem fontu), harf → `fontFamily: Typography.fontDisplay, fontSize: size * 0.38`
- `_layout.tsx`: `headerTitleStyle.fontFamily: Typography.fontDisplayMedium`
- Gereksiz `emoji` style'ı kaldırıldı, `fontFamily` inline veriliyor

**Değişen dosyalar:** `components/Avatar.tsx`, `app/(tabs)/groups/_layout.tsx`

### ✅ B35: Edit sayfası — aynı header + canlı önizleme + "DÜZENLEME MODU"

**Yapılan:**
- Edit sayfasına grup detayındakinin BİREBİR aynısı gradient header eklendi (renk, padding, stil)
- Geri butonu: aynı konum `top: 8, left: 8`, aynı stil `rgba(255,255,255,0.15)`
- Avatar, isim, açıklama: form değiştikçe header'da canlı önizleme
- Avatar üstüne yarı-saydam "DÜZENLEME MODU" etiketi eklendi (`group.editMode`)
- `useSafeAreaInsets` kaldırıldı, sabit `paddingTop: 52` kullanılıyor

**Değişen dosyalar:** `app/(tabs)/groups/[id]/edit.tsx`, `locales/tr.json`, `locales/en.json`

| Kontrol | Durum |
|---|---|
| `npx tsc --noEmit` | ✅ Temiz |
| Alt bar | ✅ Grup detayında görünür |
| Geri butonu (detay) | ✅ Gradient header sol-üst |
| Geri butonu (edit) | ✅ Aynı konum, aynı stil |
| Header fontu | ✅ Plus Jakarta Sans |
| Avatar emoji | ✅ Görünür, canlı önizleme |
| Düzenleme modu etiketi | ✅ Avatar üstünde |
| Stack header sıçraması | ✅ `animation: 'none'` ile yok |

*Son güncelleme: 2026-05-31 — B36 eklendi (tab bar + animasyonlar)*

---

## B36: Alt bar tasarımı + hafif animasyonlar (7. Tur)

> Tarih: 2026-05-31

### Alt Bar (Tab Bar)
- Aktif sekme: DOLU ikon (`people`/`time`/`person`), primary renk, altında 4px mor nokta (pill indicator)
- Pasif: OUTLINE ikon, textTertiary
- `react-native-reanimated` ile ikon scale animasyonu (1 → 1.08 → 1, spring)
- Arka plan: beyaz, üst kenarda mor tonlu hafif gölge (shadowOpacity 0.04)
- `height: 88` (iOS safe area padding dahil), `paddingBottom: 28` (iPhone home indicator)
- `TabBarButton` bileşeni: Pressable + active pill + scale animasyonu

### Animasyonlar
- **`FadeInUp`**: fade-in + slide-up, kart girişlerinde kullanılır. `prefers-reduced-motion` saygılı. Sadece mount'ta çalışır. Her kart 40ms stagger.
- **`ScaleOnPress`**: buton basışı 0.97 scale-down, spring bounce geri dönüş
- **Toast**: zaten animasyonlu (slide-up + fade), dokunmadım
- Gruplar listesi: her kart `FadeInUp` ile 40ms stagger giriş

**Yeni dosyalar:** `components/TabBarButton.tsx`, `components/Animations.tsx`

**Değişen dosyalar:** `app/(tabs)/_layout.tsx`, `app/(tabs)/groups/index.tsx`

| Kontrol | Durum |
|---|---|
| `npx tsc --noEmit` | ✅ Temiz |
| Tab bar: filled ikon | ✅ Aktif sekmede |
| Tab bar: pill indicator | ✅ 4px mor nokta |
| Tab bar: scale animasyonu | ✅ Reanimated spring |
| Tab bar: gölge | ✅ Mor tonlu, yukarı doğru |
| Tab bar: safe area | ✅ iOS 28px alt padding |
| Kart giriş animasyonu | ✅ FadeInUp + stagger |
| reduced-motion saygısı | ✅ Kontrol ediliyor |

### Header Alt Çizgisi (B36 ek)
- **Sorun:** Gruplar sayfasında header alt çizgisi yoktu. Aktivite/Hesap'ta Tabs header'ı, Gruplar'da nested Stack header'ı render ediliyordu — border davranışları farklıydı.
- **Kök neden:** `Tabs.Screen name="groups"` → `headerShown: false`. Tabs header'ı gizlenip Stack header'ı gösteriliyordu.
- **Çözüm:** `headerShown: false` kaldırıldı. Tüm sekmeler Tabs header'ı kullanıyor (aynı font, renk, alt çizgi). Stack `index` screen `headerShown: false`.
- **Değişen dosyalar:** `app/(tabs)/_layout.tsx`, `app/(tabs)/groups/_layout.tsx`
- Ayrıca: `StackHeaderBorder.tsx` (kullanılmayan) silindi.

*Son güncelleme: 2026-05-31 — B37 eklendi (hesap silme + veri dışa aktarma)*

---

## B37: Hesap silme + veri dışa aktarma (8. Tur)

> Tarih: 2026-05-31
> Apple zorunlu: uygulama içi hesap silme

### Edge Function: `delete-account`
- `supabase/functions/delete-account/index.ts`
- JWT doğrulama → kurucu grup kontrolü (başka gerçek üyeli gruplar varsa 409 FOUNDER_GROUPS_EXIST)
- Solo kurucu gruplarını sil → `auth.admin.deleteUser()` ile kullanıcıyı sil
- Cascade: auth.users → profiles, groups (solo), group_members
- Service-role key ile RLS baypas

### Hesap Silme Akışı (`app/(tabs)/account.tsx`)
- **Adım 0:** Kurucu grup kontrolü (client-side) → başka üyeli gruplar varsa Alert + engelle
- **Adım 1:** İlk onay dialog'u — uyarı metni + İptal/Hesabımı Sil
- **Adım 2:** "SİL" yazma dialog'u — yanlışlıkla basmayı önleme
- **Adım 3:** Edge Function çağrısı → signOut → giriş ekranı

### Veri Dışa Aktarma
- "Verilerimi İndir" butonu → `Share.share(JSON)` ile kullanıcının profili + üyelikleri + grupları

### i18n
- `account.exportData`, `account.deleteAccount`, `account.deleteWarning`, `account.deleteFinalTitle`, `account.deleteFinalConfirm`, `account.typeSil`, `account.deleteError`, `account.founderGroupsBlockTitle`, `account.founderGroupsBlock`

**Yeni dosyalar:** `supabase/functions/delete-account/index.ts`

**Değişen dosyalar:** `app/(tabs)/account.tsx`, `locales/tr.json`, `locales/en.json`

### Edge Function Deploy (Faz 8'de)
```bash
supabase functions deploy delete-account
# Fonksiyon URL: https://<project-ref>.supabase.co/functions/v1/delete-account
```

### Test (Expo Go)
- Edge Function çağrısı Expo Go'da çalışır (auth token geçerli olduğu sürece)
- Hesap → en alt "Hesabımı Sil" → kurucu grupları varsa engellenir → yoksa çift onay → silinir

| Kontrol | Durum |
|---|---|
| `npx tsc --noEmit` | ✅ Temiz |
| Edge Function kodu | ✅ Hazır |
| Hesap silme akışı | ✅ 3 adımlı |
| Kurucu grup kontrolü | ✅ Client + server |
| Veri dışa aktarma | ✅ JSON Share |
| i18n (tr + en) | ✅ 10 anahtar |

*Son güncelleme: 2026-05-31 — B38 eklendi (dashboard 4. sekme + ücretsiz/Pro ayrımı)*

---

## B38: Dashboard 4. sekme + ücretsiz/Pro ayrımı (9. Tur)

> Tarih: 2026-05-31

### Alt Bar — 4. Sekme
- "Panel" sekmesi: Gruplar · Panel · Aktivite · Hesap (stats-chart ikonu)
- `app/(tabs)/_layout.tsx`

### Panel Ekranı (`app/(tabs)/dashboard.tsx`)
- **ÜCRETSİZ:** Gradient hero kart (para birimi bazında bakiye), temel istatistikler (grup/masraf sayısı, en aktif grup)
- **PRO KİLİTLİ:** `expo-blur` + `ProBlurGate` — kategori dağılımı, harcama trendi, detaylı analiz blur'lu + kilit + "Pro'ya Geç" CTA
- **PRO AÇIK:** Kategori dağılımı gerçek veri, trend/analiz "Yakında" placeholder

### Temizlik
- Account'tan eski Dashboard linki kaldırıldı
- Root layout'tan eski `Stack.Screen name="dashboard"` kaldırıldı
- `app/dashboard.tsx` silindi

**Yeni:** `app/(tabs)/dashboard.tsx` | **Silinen:** `app/dashboard.tsx`

**Değişen:** `app/(tabs)/_layout.tsx`, `app/(tabs)/account.tsx`, `app/_layout.tsx`, `locales/tr.json`, `locales/en.json`

| Kontrol | Durum |
|---|---|
| `npx tsc --noEmit` | ✅ Temiz |
| 4. sekme | ✅ Panel |
| Hero + stats (free) | ✅ |
| Blur önizleme | ✅ expo-blur + CTA |
| Kategori (Pro) | ✅ Gerçek veri |
| Eski dashboard | ✅ Silindi |

*Son güncelleme: 2026-05-31 — B39 eklendi (dashboard düzeltmeleri)*

---

## B39: Dashboard düzeltmeleri

> Tarih: 2026-05-31

### Hero kart
- +/- işaretleri kaldırıldı; yön bilgisi renk + kelime ile (alacaklısın/borglusun)
- Her para birimi ayrı satır: [TRY badge küçük] + [rakam büyük bold] + [durum kelimesi]
- Font boyutu dinamik: 1 birim → 40, 2 birim → 34, 3+ birim → 28
- Alacak: `#A7F3D0` (açık yeşil tint), borç: `rgba(255,255,255,0.5)` (yarı-saydam beyaz)
- Padding: 20px

### Kategori Dağılımı — herkese açık
- Kategori listesinden blur **kaldırıldı** — ücretsizde de açık
- Kategori noktaları: `CATEGORY_COLORS` ile her kategori kendi rengi
- Para birimi `Intl.NumberFormat` ile otomatik (₺/€/$)

### Pro kilitli bölümler
- Sadece "Harcama Trendi" ve "Detaylı Grup Analizi" blur'lu
- Pro modda bu bölümler **tamamen gizli** (placeholder/"Yakında" yok)

**Değişen dosyalar:** `app/(tabs)/dashboard.tsx`

| Kontrol | Durum |
|---|---|
| `npx tsc --noEmit` | ✅ Temiz |
| Hero taşma | ✅ Düzeltildi |
| +/- işareti | ✅ Kaldırıldı |
| Kategori blur | ✅ Kaldırıldı (free) |
| Kategori renk | ✅ categories.ts |
| Pro placeholder | ✅ Gizli |
| DEV test | ✅ Butonla Pro toggle |

*Son güncelleme: 2026-05-31 — B41 eklendi (groups butonlar + tips)*

---

## B40: Tips/Yardım popup'ları
- `TipsModal` + `TipsButton`: "?" butonu → gradient başlıklı ipucu popup'ı
- Grup detayı, masraf ekleme, üye yönetimi sayfalarına `headerRight` eklendi
- Dashboard "En Aktif Grup" kartı layout düzeltildi
- **Dosyalar:** `TipsModal.tsx`, `TipsButton.tsx`, 3 sayfa güncellendi, `locales/*`

## B41: Gruplar ekranı butonları
- FAB kaldırıldı → alt bar: "Gruba Katıl" (outline sol) + "+ Yeni Grup" (gradient sağ)
- Yeni Grup: modal → push `/groups/new` screen (yandan slide)
- Limit: sağ buton gri+kilit, "1 hakkın kaldı" badge
- **Dosyalar:** `app/(tabs)/groups/index.tsx`, `new.tsx` (yeni), `_layout.tsx`

| Kontrol | Durum |
|---|---|
| `npx tsc --noEmit` | ✅ Temiz |

*Son güncelleme: 2026-05-31 — B42 eklendi*

---

## B42: Grup sayfalarında çift header kaldırıldı
- Sorun: Grup detay/edit/new sayfalarında Tabs header "Gruplar" + Stack header iç içe görünüyordu
- Tabs header: `headerShown: false` → sadece Stack header'lar gösteriliyor
- Groups list: Stack header "Gruplar" (title)
- Grup detay: "Grup Detayı" + geri, Edit: "Grubu Düzenle" + geri, New: "Yeni Grup" + geri
- Alt bar label düzeltildi (title eksikti)
- Tüm header'lar aynı font/renk/çizgi

**Dosyalar:** `app/(tabs)/_layout.tsx`, `app/(tabs)/groups/_layout.tsx`

*Son güncelleme: 2026-05-31 — B43 eklendi*

---

## B43: Paywall modern fintech tasarımı + Grup Pro temizliği
- Grup Pro ölü kodları temizlendi
- Tasarım: bordered kartlar → açık row'lar, soft shadow price kart, full-width CTA
- Feature ikonları: 44px purple ghost yuvarlak
- Tüm opacity concat → solid Colors sabitleri
- Already Pro: aynı tasarım dili

**Dosya:** `app/paywall.tsx`

*Son güncelleme: 2026-06-01 — B44 eklendi*

---

## B44: Pro analitik paneli + Wise numpad (10. Tur)

> Tarih: 2026-06-01

### Pro Dashboard Analitiği
- `getProDashboardAnalytics()` — aylık harcama trendi, top kategori, en hareketli ay
- `SimpleBarChart`: View-tabanlı bar chart, sıfır native bağımlılık
- gifted-charts + react-native-svg → Expo 54 uyumsuz → kaldırıldı
- Pro: BarChart + insight kartları (En Hareketli Ay, Popüler Kategori)
- Free: kilitli placeholder + "Pro'ya Geç" CTA

### Wise Numpad (Add Expense)
- Geleneksel input → Wise tarzı numpad grid (48px bold tutar)
- Para birimi pill seçici, genişletilebilir detaylar

**Dosyalar:** `lib/supabase/queries.ts`, `app/(tabs)/dashboard.tsx`, `app/groups/[id]/add-expense.tsx`

| Kontrol | Durum |
|---|---|
| `npx tsc --noEmit` | ✅ Temiz |
| BarChart | ✅ View-tabanlı |
| Numpad | ✅ Wise tarzı |

*Son güncelleme: 2026-06-01 — B45 eklendi*

---

## B45: Grup detay/edit geri butonu — nested Stack kaldırıldı

**Sorun:** Nested Stack `index` root olduğu için otomatik geri butonu göstermiyordu.

**Çözüm:** `app/groups/[id]/_layout.tsx` silindi. 4 route doğrudan root Stack'te `headerShown: true` ile. Hepsi aynı iOS geri butonu.

**Dosyalar:** `app/groups/[id]/_layout.tsx` (silindi), `app/_layout.tsx`

*Son güncelleme: 2026-06-01 — B46 eklendi*

---

## B46: Header mimarisi kararları + add-expense düzeltmeleri

> Tarih: 2026-06-01

### Header Mimarisi (KRİTİK — çok uğraştırdı)
- **Tabs `headerShown: false`** (groups tab) — Tabs header tamamen kaldırıldı
- **Stack yönetiyor**: `app/(tabs)/groups/_layout.tsx`
  - `index` → "Gruplar" (geri yok)
  - `[id]/index` → "Grup Detayı" + otomatik `< Geri`
  - `[id]/edit` → "Grubu Düzenle" + otomatik `< Geri`
- **ASLA** root Stack'e taşıma (alt bar kaybolur)
- **ASLA** nested `app/groups/[id]/_layout.tsx` (route çakışması)
- `groups.tsx` → `groups/index.tsx` (duplicate fix)
- Gradient header'larda geri butonu YOK (Stack sağlıyor)

### Add-Expense Düzeltmeleri (B44 devamı)
- Açıklama: statik `Text` → `TextInput`
- `splitEqual()` ile kuruş hatasız bölüşme (`toMinor`/`fromMinor`)
- Split type seçici (equal/custom/subset) geri getirildi
- CTA validasyon: `amount > 0 && description && paidById`

### CLAUDE.md
- Monetizasyon, header mimarisi, UI/UX kararları güncellendi
- Tab bar, dashboard, paywall, add-expense kuralları eklendi
- "DO NOT BREAK" uyarıları

**Dosyalar:** `app/(tabs)/_layout.tsx`, `app/(tabs)/groups/_layout.tsx`, `app/(tabs)/groups/[id]/add-expense.tsx`, `CLAUDE.md`

| Kontrol | Durum |
|---|---|
| `npx tsc --noEmit` | ✅ Temiz |
| Header: list | ✅ "Gruplar" |
| Header: detail | ✅ "Grup Detayı" + `< Geri |
| Header: edit | ✅ "Grubu Düzenle" + `< Geri |
| Alt bar | ✅ Tüm sayfalarda |
| Add-expense: splitEqual | ✅ Kuruş hatasız |
| Add-expense: validasyon | ✅ 3 koşul |

*Son güncelleme: 2026-06-01 — B47-B51 eklendi (add-expense regresyon düzeltmeleri)*

---

## Add-Expense Regresyon Düzeltmeleri (11. Tur — B47-B51)

> Tarih: 2026-06-01
> Bağlam: Faz 4'te tam çalışan add-expense ekranı, B44 (Wise numpad) tasarımı sırasında işlevsel regresyonlar yaşadı. Aşağıdaki düzeltmeler kaybolan özellikleri geri getirir.

### ✅ B47: Bölüşme tipi çalışmıyordu — düzeltildi

**Sorun:** `splitType` state'i seçiliyordu ama `handleSave` HER ZAMAN `splitEqual` çağırıyordu. "Özel" ve "Alt-küme" seçilse bile eşit bölüyordu.

**Yapılan:**
- `handleSave` artık `splitType`'a göre doğru fonksiyonu çağırıyor:
  - `'equal'` → `splitEqual()`
  - `'custom'` → `splitCustomAmounts()` — her üye için tutar giriş input'u
  - `'subset'` → `splitSubset()` — üye checkbox seçimi
- Custom modda: her aktif üye için `TextInput`, anlık kalan/toplam kontrolü
- "Kalanı X'e tamamla" butonu (kalanı ödeyene otomatik ekler)
- Toplam tutmayınca `splitCustomAmounts` exception fırlatır → kaydet engellenir
- Subset modda: checkbox listesi, "Tümünü Seç/Kaldır", sadece seçili üyelere eşit bölüşme
- `lib/finance/split.ts`'teki tüm fonksiyonlar zaten vardı ve testliydi (75/75 test geçiyor)

### ✅ B48: "Diğer" para birimi seçeneği geri getirildi

**Sorun:** Sadece TRY/USD/EUR vardı. Eski versiyonda 20 para birimi seçilebiliyordu.

**Yapılan:**
- `PRIMARY_CURRENCIES` (TRY/USD/EUR) yanında "Diğer" pill'i eklendi
- "Diğer"e basınca `SUPPORTED_CURRENCIES` listesinden seçim modal'ı açılır (flag + kod + isim)
- Aktif para birimi PRIMARY değilse "Diğer" pill'i aktif gösterilir ve kod yazar
- `lib/finance/money.ts`'teki 20 para birimi kullanıldı

### ✅ B49: Canlı bölüşme önizlemesi eklendi

**Sorun:** Bölüşme tipine göre "kim ne kadar ödeyecek" önizlemesi yoktu. Kullanıcı kaydedene kadar göremiyordu.

**Yapılan:**
- `splitPreview` useMemo: `amountStr`, `currency`, `splitType`, `customAmounts`, `selectedSubsetMembers` değiştikçe anlık hesaplanır
- Eşit: her üyenin payı otomatik gösterilir
- Özel: girilen tutarlar + kalan/taşma göstergesi
- Alt-küme: sadece seçili üyelerin payı
- Önizleme kartı: üye isimleri + tutarlar + toplam satırı
- Özel modda "Kalan: X" / "Toplamı aştınız" / "Tam eşleşme" durum göstergeleri

### ✅ B50: Düzenleme modu geri getirildi

**Sorun:** Eski versiyon `expenseId` paramıyla düzenleme yapabiliyordu. Bu versiyonda tamamen kayıptı.

**Yapılan:**
- `useLocalSearchParams`'tan `expenseId` alınır
- `expenseId` varsa: Supabase'den masraf + split'ler yüklenir, tüm alanlar doldurulur
- Kaydette `useUpdateExpense` mutation'ı çağrılır
- `expenseId` yoksa: boş form, `useAddExpense` ile yeni ekleme
- Başlık dinamik: `navigation.setOptions({ title: ... })` ile "Masraf Ekle" / "Masrafı Düzenle"
- Custom/subset split tipi için state'ler geri yüklenir
- Yükleme sırasında spinner gösterilir

### ✅ B51: Tarih seçici eklendi

**Sorun:** Tarih hep bugündü, değiştirilemiyordu.

**Yapılan:**
- Varsayılan bugün, değiştirilebilir
- Takvim ikonlu buton → basit takvim modal'ı (View-tabanlı, sıfır native bağımlılık)
- Ay gezintisi (← → oklar), gün grid'i (6×7)
- Bugün butonu, seçili gün primary renkle vurgulu
- Ay/gün isimleri locale'e göre TR/EN
- `formatDateDisplay`: "1 Haziran 2026" formatında gösterim

### ✅ B52: Numpad sadece tutar girerken görünür

**Sorun:** Numpad her zaman ekranın altında duruyordu, detayları doldururken ekranı daraltıyordu.

**Yapılan:**
- `showNumpad` state'i eklendi (varsayılan: `true`)
- Detaylar açılınca numpad gizlenir, kapanınca geri gelir
- Tutar alanına dokununca numpad toggle
- Numpad gizliyken tutar alanında "tutarı düzenlemek için dokun" ipucu
- Kaydet butonu her zaman görünür

### ✅ B53: Detay butonu metni değişti

**Sorun:** Açıklama girilmemişken "örn. Market alışverişi" yazıyordu, butonun ne işe yaradığı belli değildi.

**Yapılan:**
- Placeholder metni: "detayları girmek için tıkla"
- Açıklama girilince girilen metin gösterilir
- i18n: `expense.tapToDetails`

**Değişen dosyalar:** `app/(tabs)/groups/[id]/add-expense.tsx`, `locales/tr.json`, `locales/en.json`

| Kontrol | Durum |
|---|---|
| `npx tsc --noEmit` | ✅ Temiz |
| Split testleri (vitest 75) | ✅ 75/75 geçti |
| Bölüşme: eşit | ✅ splitEqual |
| Bölüşme: özel | ✅ splitCustomAmounts + kalan kontrolü |
| Bölüşme: alt-küme | ✅ splitSubset + üye seçimi |
| Diğer para birimi | ✅ 20 birimli modal |
| Canlı önizleme | ✅ Anlık güncelleniyor |
| Düzenleme modu | ✅ expenseId ile yükleme |
| Tarih seçici | ✅ Takvim modal'ı |
| Numpad toggle | ✅ Detay açınca gizlenir |
| Detay butonu metni | ✅ "detayları girmek için tıkla" |

*Son güncelleme: 2026-06-01 — B54-B56 eklendi (dashboard para birimi karışması düzeltmeleri)*

---

## Dashboard Para Birimi Karışması Düzeltmeleri (12. Tur — B54-B56)

> Tarih: 2026-06-01
> Bağlam: Proje kuralı: para birimleri ASLA toplanmaz/çevrilmez. Dashboard'ta 3 yerde bu kural ihlal ediliyordu.

### ✅ B54: Trend grafiği para birimi karıştırma düzeltildi

**Sorun:** `getProDashboardAnalytics` `baseCurrency = 'TRY'` hardcode ile çağrılıyordu. Kullanıcının EUR ağırlıklı masrafları olsa bile TRY filtreleniyor, TRY masrafı azsa boş trend gösteriliyordu.

**Yapılan:**
- `getProDashboardAnalytics` artık dominant para birimini **otomatik belirler**: son 6 aydaki masrafları sayar, en sık kullanılan para birimini seçer
- Sadece o para birimindeki masraflar trend/kategori hesabına katılır — asla karıştırılmaz
- `DashboardAnalyticsData` interface'ine `trendCurrency: string` eklendi

### ✅ B55: Trend grafiğinde para birimi etiketi eklendi

**Sorun:** Kullanıcı hangi para biriminde trend gördüğünü bilmiyordu.

**Yapılan:**
- Chart başlığı: `"Aylık Harcama (TRY)"` formatında, aktif para birimi parantez içinde
- Chart altında: `"Sadece TRY masraflar gösteriliyor"` küçük not

### ✅ B56: Kategori tutarı para birimi düzeltildi

**Sorun:** Kategori dağılımı tüm masrafları `share_amount` topluyor, `currency: 'TRY'` hardcode ile formatlanıyordu. EUR/USD masrafları yanlış TRY olarak gösteriliyordu.

**Yapılan:**
- `catCurrencyMap` — her kategori `"kategori::paraBirimi"` anahtarıyla saklanır
- Dominant para birimi belirlenir, sadece o para biriminin kategorileri gösterilir
- Formatlama gerçek para birimiyle yapılır (`d.catCurrency`)
- Birden fazla para birimi varsa: başlıkta `"(TRY)"` ibaresi + altta `"Not: Sadece TRY masraflar gösteriliyor. Diğer para birimleri ayrı hesaplanır."` notu

**Değişen dosyalar:** `lib/supabase/queries.ts`, `app/(tabs)/dashboard.tsx`, `locales/tr.json`, `locales/en.json`

| Kontrol | Durum |
|---|---|
| `npx tsc --noEmit` | ✅ Temiz |
| Trend para birimi otomatik | ✅ Dominant currency |
| Chart para birimi etiketi | ✅ Aylık Harcama (X) |
| Kategori formatlama | ✅ Gerçek para birimiyle |
| Çoklu para birimi notu | ✅ Gösteriliyor |
| Para birimleri toplanmıyor | ✅ Hepsi ayrı |

*Son güncelleme: 2026-06-01 — B57 eklendi (dashboard para birimi seçici + profil varsayılan)*

---

## Dashboard Para Birimi Seçici + Profil Varsayılanı (13. Tur — B57)

> Tarih: 2026-06-01
> Bağlam: Dashboard sadece dominant para birimini gösteriyordu (B54-B56). EUR/USD masraflar için kullanıcı para birimini değiştiremiyordu.

### ✅ B57: Dashboard para birimi seçici + profil varsayılan para birimi

**Sorun:** Kullanıcı dashboard'da farklı para birimindeki masraflarını göremiyordu. Para birimleri arasında geçiş yapacak mekanizma yoktu.

**Yapılan:**

1. **Migration (0008):** `profiles.preferred_currency text` — NULL = otomatik dominant.
2. **Profil ayarı (`account.tsx`):** "Varsayılan Para Birimi" bölümü. Otomatik + TRY/USD/EUR + kullanıcının kullandığı para birimleri.
3. **Dashboard seçici (`dashboard.tsx`):** Hero altına yatay chip satırı. Kullanılan para birimleri. Tek para biriminde gizli.
4. **Seçili para birimine göre:** Kategori + trend `selectedCurrency` ile filtrelenir. Analytics queryKey'e `activeCurrency` eklendi.
5. **`getProDashboardAnalytics`:** Opsiyonel `currency` parametresi — geriye uyumlu.
6. **`getUserCurrencies()`:** Yeni query — kullanıcının benzersiz para birimleri.

**Değişen dosyalar:**
- `supabase/migrations/0008_preferred_currency.sql` (yeni)
- `lib/supabase/types.ts`, `lib/auth/types.ts` — `preferred_currency` alanı
- `lib/auth/AuthContext.tsx` — interface + implementation + profileRowToProfile
- `lib/supabase/queries.ts` — `updateProfileRow`, `getUserCurrencies`, `getProDashboardAnalytics(currency?)`
- `app/(tabs)/dashboard.tsx` — currency selector + filtreleme
- `app/(tabs)/account.tsx` — varsayılan para birimi bölümü
- `locales/tr.json`, `locales/en.json`

**Korunan:** B54-B56 dominant fallback, SimpleBarChart, hero kart, para birimleri toplanmaz kuralı.

| Kontrol | Durum |
|---|---|
| `npx tsc --noEmit` | ✅ Temiz |
| Migration | ✅ 0008 çalıştı |
| Dashboard: çoklu para biriminde seçici | ✅ Gösteriliyor |
| Dashboard: tek para biriminde seçici | ✅ Gizli |
| Para birimi değişince trend+kategori | ✅ Yenileniyor |
| Profil varsayılanı dashboard'ı etkiliyor | ✅ `preferred_currency` öncelikli |
| Otomatik (null) | ✅ Dominant otomatik |
| Para birimleri toplanmaz | ✅ Ayrı ayrı |

*Son güncelleme: 2026-06-01 — B57 eklendi (dashboard para birimi seçici + profil varsayılan)*

---

### ✅ B58: Dashboard "Detaylı Analiz" bölümü gerçek içerikle dolduruldu

**Sorun:** Pro'da "Detaylı Analiz" bölümü sadece `mostActiveMonth` + `topCategory` gösteriyordu. Yetersizdi.

**Yapılan:**
- `getProDashboardAnalytics` genişletildi — 2 yeni alan: `topPayer` (en çok ödeyen) ve `settlementSummary` (borç/alacak özeti)
- **topPayer:** Seçili para biriminde en çok masraf giren kişi (isim, masraf sayısı, toplam tutar). `paid_by` + `group_members.display_name` lookup.
- **settlementSummary:** Seçili para biriminde confirmed settlements → `paid` (ödediğin) + `received` (sana ödenen).
- **Dashboard UI:** "Detaylı Analiz" başlığı + para birimi etiketi altında:
  - Satır 1: En Hareketli Ay + Popüler Kategori (mevcut, korundu)
  - Satır 2: En Çok Ödeyen (tam genişlik kart: ikon + isim + tutar + masraf sayısı)
  - Satır 3: Ödediğin + Sana Ödenen (2'li kart: kırmızı ok + yeşil ok)
  - Boş veri: kartlar gizlenir, "Henüz bakiye yok" fallback gösterilir.
- **i18n:** `dashboard.topPayer`, `dashboard.topPayerDesc`, `dashboard.settlementPaid`, `dashboard.settlementReceived` (tr + en)
- **Yardımcı:** `formatAmount()` fonksiyonu eklendi (Intl.NumberFormat + fallback)
- Tüm metrikler seçili `activeCurrency` bazında. Para birimleri toplanmaz kuralı korundu.

**Değişen dosyalar:**
- `lib/supabase/queries.ts` — `DashboardAnalyticsData` interface + `getProDashboardAnalytics` genişletildi
- `app/(tabs)/dashboard.tsx` — yeni kartlar, `formatAmount`, stiller
- `locales/tr.json`, `locales/en.json` — yeni dashboard anahtarları

| Kontrol | Durum |
|---|---|
| `npx tsc --noEmit` | ✅ Temiz |
| Para birimleri toplanmaz | ✅ Korundu |
| Seçili para birimi değişince yenileme | ✅ queryKey'de `activeCurrency` var |
| Boş veride kart gizleme | ✅ `topPayer`/`settlementSummary` null ise gizli |
| DEV Pro butonuyla test | ✅ `__DEV__` toggle ile Pro aktif edilir |

*Son güncelleme: 2026-06-01 — B59 eklendi (kurucu ayrılma kenar durumu + grup silme sonrası)*

---

## B59: Kurucu ayrılma kenar durumu + grup silme sonrası temizlik (14. Tur)

> Tarih: 2026-06-01

### Kurucu Ayrılma — Gerçek Üye Kontrolü

**Sorun:** Kurucu ayrılmak istediğinde `handleLeave` tüm aktif üyeleri sayıyordu (hayaletler dahil). Grupta sadece hayalet üye varsa, kurucu devir picker'ı gösteriliyor ama devredecek gerçek kullanıcı yoktu. Hayalete devir anlamsızdı.

**Yapılan:**
- `realActiveMembers` filtresi eklendi: `user_id IS NOT NULL` + `is_active = true`
- `handleLeave`: kurucu için devir kontrolü artık `realActiveMembers` bazlı — gerçek üye yoksa devir sorusu sorulmaz, direkt grup silme önerilir
- Transfer picker'ı da `realActiveMembers` kullanıyor — hayaletler listede görünmez
- `leaveSoloFounder` mesajı güncellendi: "Grupta devredebileceğin başka üye yok. Gruptan ayrılmak için grubu silmen gerekiyor."

### Grup Silme Sonrası Durum

**Sorun:** `useDeleteGroup` hook'u cache invalidation'da `['group']` (generic) kullanıyordu, `['group', groupId]` spesifik sorguları invalidate olmuyordu.

**Yapılan:**
- `useDeleteGroup` `onSuccess` artık `(data, groupId)` parametrelerini alıp `['group', groupId]` spesifik invalidate yapıyor
- Silme sonrası `router.replace('/(tabs)/groups')` ile gruplar listesine dönülür (mevcut, değişmedi)
- Cascade: expenses, splits, settlements, activity_log, group_members — DB seviyesinde cascade ile silinir
- Grup Pro entitlement: kayıt silindiği için otomatik geçersiz — ek işlem gerekmez
- Silme bildirimi: Faz 8'e bırakıldı (şu an yok)

**Değişen dosyalar:**
- `app/(tabs)/groups/[id]/edit.tsx` — `realActiveMembers` + handleLeave + transfer picker
- `hooks/useGroupDetail.ts` — `useDeleteGroup` cache invalidation
- `locales/tr.json` — `group.leaveSoloFounder` güncellendi
- `locales/en.json` — `group.leaveSoloFounder` güncellendi

| Kontrol | Durum |
|---|---|
| `npx tsc --noEmit` | ✅ Temiz |
| Kurucu + sadece hayalet → devir yok, sil öner | ✅ |
| Kurucu + gerçek üye var → devir picker'ı | ✅ |
| Transfer picker: sadece gerçek üyeler | ✅ |
| Normal üye ayrılma | ✅ Değişmedi |
| Grup silme → cache temizliği | ✅ `['group', groupId]` |
| Grup silme → gruplar listesine dönüş | ✅ `router.replace` |
| i18n (tr + en) | ✅ Güncellendi |

*Son güncelleme: 2026-06-01 — B61 eklendi (dashboard TipsButton + gruplar header border)*

---

## B61: Dashboard TipsButton tutarlılığı + Gruplar header alt çizgisi

> Tarih: 2026-06-01

**Sorun:**
- Dashboard TipsButton'u (`useLayoutEffect` + `navigation.setOptions` ile) diğer sayfalardaki TipsButton'lardan farklı görünüyordu. Tab header ile Stack header arasındaki `headerRight` render farkı sebebiyle buton konumlandırması tutarsızdı.
- Gruplar sekmesindeki Stack header'ın alt çizgisi (border) görünmüyordu. `0d7e028` commitinde Tab header tekrar gizlenip Stack header'a geçilirken `headerShadowVisible` default olarak Android'de `false` olduğu için alt çizgi kaybolmuştu (`7a42fa5`'te düzeltilmişti, sonra tekrar bozuldu).

**Yapılan:**
- **Dashboard TipsButton:** `dashboard.tsx` içindeki `useLayoutEffect`/`navigation.setOptions` kodu kaldırıldı. TipsButton doğrudan `_layout.tsx`'teki `Tabs.Screen` options'ında `headerRight` olarak tanımlandı. Bu, title ve tabBarIcon gibi diğer tab seçenekleriyle aynı seviyede yapılandırılmasını sağladı ve Tab header'ın kendi render yapısıyla uyumlu hale getirdi.
- **Gruplar header alt çizgisi:** `groups/_layout.tsx` Stack `screenOptions`'a `headerShadowVisible: true` eklendi. Tüm Stack header'larda (index, new, detail, add-expense, members, edit) alt çizgi görünür oldu.

**Değişen dosyalar:**
- `app/(tabs)/_layout.tsx` — TipsButton import + dashboard `headerRight` eklendi
- `app/(tabs)/dashboard.tsx` — TipsButton + useNavigation + useLayoutEffect kaldırıldı
- `app/(tabs)/groups/_layout.tsx` — `headerShadowVisible: true` eklendi

**Üst bar mimarisi (mevcut durum - referans):**
- Tabs header: `headerStyle.backgroundColor: Colors.background`, `headerShadowVisible: true` (varsayılan)
- Groups Stack header: `headerStyle.backgroundColor: Colors.background`, `headerShadowVisible: true` (explicit)
- Her iki header tipi de aynı font/renk/çizgi özelliklerine sahip
- Gruplar sekmesi: `headerShown: false` → Stack header yönetiyor
- Diğer sekmeler: Tab header kullanıyor

| Kontrol | Durum |
|---|---|
| `npx tsc --noEmit` | ✅ Temiz |
| Dashboard TipsButton header'da görünür | ✅ |
| Gruplar listesi header alt çizgisi | ✅ |
| Grup detayı header alt çizgisi | ✅ |
| Diğer Stack header'lar | ✅ |
| Mevcut TipsButton kullanımları korundu | ✅ (grup detayı + members + add-expense) |
| Tab header'lar değişmedi | ✅ (activity + account) |

---

## B60: add-expense ve dashboard sayfalarına TipsButton eklendi

> Tarih: 2026-06-01

**Yapılan:**
- **add-expense.tsx:** Header sağ üste TipsButton eklendi. 4 ipucu: tutar/para birimi girişi, bölüşme tipleri (eşit/özel/alt-küme), ödeyen mantığı, tarih değiştirme.
- **dashboard.tsx:** Header sağ üste TipsButton eklendi. 4 ipucu: para birimi seçici, kategori/trend grafiği, Pro detaylı analiz, para birimleri ayrı takip.
- **i18n (`tips.addExpense.*`):** tr.json güncellendi — tip3 "fiilen" vurgusu, tip4 "tarih/takvim ikonu" olarak değişti. en.json da aynı şekilde güncellendi.
- **i18n (`tips.dashboard.*`):** tr.json + en.json — yeni 5 anahtar (title + 4 tip).

**Değişen dosyalar:**
- `app/(tabs)/groups/[id]/add-expense.tsx` — TipsButton import + useLayoutEffect
- `app/(tabs)/dashboard.tsx` — TipsButton import + useNavigation + useLayoutEffect
- `locales/tr.json` — tips.addExpense güncellendi + tips.dashboard eklendi
- `locales/en.json` — tips.addExpense güncellendi + tips.dashboard eklendi

| Kontrol | Durum |
|---|---|
| `npx tsc --noEmit` | ✅ Temiz |
| TipsButton bileşeni değişmedi | ✅ Sadece kullanıldı |
| add-expense header sağ üst "?" | ✅ |
| dashboard header sağ üst "?" | ✅ |
| i18n tr + en | ✅ |
| Mevcut TipsButton kullanımları korundu | ✅ (grup detayı + members) |

*Son güncelleme: 2026-06-01 — B61 eklendi (dashboard TipsButton + gruplar header border)*

---

### ✅ B62: Grup detay/düzenleme header butonları yukarı yaslandı + çift başlık giderildi

> Tarih: 2026-06-01

**Sorun:**
- Grup detay ve düzenleme sayfalarında gradient header içindeki nav butonları (geri/düzenle/tips) çok aşağıdaydı, üstlerinde gereksiz mor boşluk vardı.
- Sebep 1: `headerGradient` static style'ında `paddingTop: Spacing.lg` (20px) + `headerTopBar` inline `paddingTop: insets.top + 4` = çift katmanlı padding butonları aşağı itiyordu.
- Sebep 2: `content` (`contentContainerStyle`) `padding: spacing.md` (12px) ScrollView içinde gradient'i 12px aşağı itiyordu.
- Gruplar listesinde Tab header + Stack header çakışmasından çift "Gruplar" başlığı görünüyordu.

**Yapılan:**
- `headerGradient` static style: `paddingTop` tamamen kaldırıldı. `borderRadius: Radius.xl` korundu (tüm köşeler yuvarlak, eski kart görünümü).
- `headerTopBar` inline: `paddingTop: 4`. Safe area React Navigation tarafından zaten handle ediliyor.
- `content`: `padding: spacing.md` → `paddingTop: 12, paddingHorizontal: spacing.md, paddingBottom: spacing.xxl * 2`.
- **Gruplar listesi çift başlık:** `groups/index.tsx` — `useLayoutEffect` `setOptions({ title })` → `setOptions({ headerShown: false })`. Tab header "Gruplar" gösterir, Stack header gizlenir.
- **Tab sıralaması:** Panel ilk sıraya alındı: `Gruplar · Panel · Aktivite · Hesap` → `Panel · Gruplar · Aktivite · Hesap`.
- Dashboard TipsButton: `headerRight` wrapper'a `marginRight: 8` eklendi, TipsButton icon size 22→24.

**Gradient header yeni padding yapısı (referans):**
| Katman | Önce | Sonra |
|---|---|---|
| `content` paddingTop | 12px | **12px** |
| `headerGradient` static paddingTop | `Spacing.lg` (20px) | **yok** |
| `headerTopBar` inline paddingTop | `insets.top + 4` (~51px) | **4px** |

**Değişen dosyalar:**
- `app/(tabs)/groups/[id]/index.tsx` — headerGradient paddingTop kaldırıldı, headerTopBar paddingTop: 2, content paddingTop: 8
- `app/(tabs)/groups/[id]/edit.tsx` — aynı değişiklikler
- `app/(tabs)/groups/index.tsx` — useLayoutEffect headerShown: false
- `app/(tabs)/_layout.tsx` — tab sıralaması Panel önce
- `app/(tabs)/dashboard.tsx` — TipsButton marginRight wrapper
- `components/TipsButton.tsx` — icon size 22→24

| Kontrol | Durum |
|---|---|
| `npx tsc --noEmit` | ✅ Temiz |
| Grup detay butonları üste yaslı | ✅ |
| Grup düzenleme butonları üste yaslı | ✅ |
| Gruplar listesi tek başlık | ✅ |
| Tab sıralaması Panel · Gruplar · Aktivite · Hesap | ✅ |
| headerGradient borderRadius korundu | ✅ |
| Alt bar tüm ekranlarda | ✅ |

**Son düzeltme (padding + stil):**
- Gruplar bottom bar: `paddingBottom: 36 → 12`, `backgroundColor: Colors.surface → Colors.background`, `borderTopWidth` + `borderTopColor` kaldırıldı. Butonlar alt bara ve sayfa arka planına yakınlaştı, aradaki çizgi yok.

*Son güncelleme: 2026-06-01 — B62 eklendi (header butonları + çift başlık + tab sıralaması + groups bottom bar)*

---

### ✅ B63: Para/tutar formatı tutarsızlığı düzeltildi

**Sorun:** Panel "₺591,63" (doğru tr-TR formatı), Aktivite "500.5 TRY" (ham sayı), masraf kartları "350.50 TRY" (sembolsüz, noktalı) gösteriyordu.

**Yapılan:**
- `lib/finance/money.ts` — `formatAmount(amount, currency)` fonksiyonu eklendi. `Intl.NumberFormat('tr-TR', { style:'currency', currency })` kullanır. Sembol + binlik nokta + ondalık virgül: `₺591,63`, `€50,00`, `$100,00`, `₺50.050.050,00`.
- `lib/finance/index.ts` — barrel export'a eklendi.
- `app/(tabs)/dashboard.tsx` — yerel `formatAmount` kaldırıldı, `@/lib/finance`'ten import ediliyor.
- `app/(tabs)/activity.tsx` — `formatActivity()` içinde `expense_added`, `settlement_marked` tutarları formatlanıyor.
- `app/(tabs)/groups/[id]/index.tsx` — 12 noktada `toFixed() + currency` → `formatAmount()`: masraf kartı tutarı, split detay, self summary, raw/simplified bakiye, bekleyen ödemeler, settlement modal, FX display, aktivite, hatırlatma mesajı.
- `locales/tr.json`, `locales/en.json` — i18n template'lerinden ayrı `{{currency}}`/`{{cur}}` parametreleri kaldırıldı (formatAmount zaten sembolü içeriyor). 8 key güncellendi.

**Değişen dosyalar:** `lib/finance/money.ts`, `lib/finance/index.ts`, `app/(tabs)/dashboard.tsx`, `app/(tabs)/activity.tsx`, `app/(tabs)/groups/[id]/index.tsx`, `locales/tr.json`, `locales/en.json`

---

### ✅ B64: Masraf kartı layout düzeltmesi

**Sorun:** Masraf adı + tutar aynı satırda yan yana. Açıklama uzayınca tutar sağa sıkışıyor veya üst üste biniyordu. Kategori, düzenle/sil/genişlet butonları da aynı satırda karışıyordu.

**Yapılan:**
- Kart 3 satıra bölündü:
  - **Satır 1:** `[kategori ikon] [masraf adı (flex:1, 2 satır)] [tutar (flexShrink:0, sağda sabit)]`
  - **Satır 2:** `"Ali ödedi · 1 Haz 2026"`
  - **Satır 3:** `kategori (sol) · ✏️ 🗑️ ⌄ butonları (sağ)`
- Tutar `flexShrink:0` ile her zaman sağ üstte sabit, uzun metinlerle çakışmaz.
- Kategori ayrı satıra alındı, butonlar `expenseActions` ile sağa yaslandı.
- Kullanılmayan `splitSummary`/`splitChip` stilleri temizlendi, `expenseCategory` stili geri eklendi.

**Değişen dosyalar:** `app/(tabs)/groups/[id]/index.tsx`

---

---
### 🔒 P0-1 / B65: SECURITY DEFINER RPC'lere auth.uid() yetki kontrolü eklendi

**Sorun:** `add_expense_with_splits`, `add_settlement`, `confirm_settlement`, `reject_settlement` fonksiyonları `SECURITY DEFINER` ile RLS'i bypass ediyor ama içlerinde hiçbir `auth.uid()` yetki kontrolü yoktu. Anon key'e sahip herhangi biri:
- Başkasının grubuna masraf ekleyebilir (`add_expense_with_splits`)
- Sahte settlement oluşturabilir (`add_settlement`)
- Başkasının settlement'ını onaylayabilir/reddedebilir (`confirm_settlement`/`reject_settlement`)

**Yapılan (Migration 0009):**
- **`add_expense_with_splits`:** 5 yeni kontrol eklendi
  1. `p_amount > 0` kontrolü
  2. `p_created_by` → `auth.uid()` ile eşleşen, aynı grupta aktif üye mi?
  3. `p_paid_by` → aynı grupta aktif üye mi?
  4. `sum(p_splits.share_amount) == p_amount` (1 kuruş tolerans)
  5. Her split üyesi aynı grupta aktif üye mi?
- **`add_settlement`:** 4 yeni kontrol
  1. `p_marked_by` → `auth.uid()` ile eşleşen aktif üye mi?
  2. `p_from_member` aynı grupta aktif mi?
  3. `p_to_member` aynı grupta aktif mi?
  4. `p_marked_by`, `p_from_member` veya `p_to_member`'dan biri olmalı
- **`confirm_settlement`:** 4 yeni kontrol
  1. Settlement mevcut mu?
  2. Status hâlâ 'pending' mi?
  3. `p_confirmed_by` → `auth.uid()` ile eşleşen aktif üye mi?
  4. `p_confirmed_by` → settlement'ın `to_member`'ı (alacaklı) olmalı
- **`reject_settlement`:** Aynı 4 kontrol (alacaklı reddedebilir)
- Tüm fonksiyon imzaları **KORUNDU** — client kodu değişmedi.
- Tüm hata mesajları Türkçe.
- Migration idempotent (`CREATE OR REPLACE`).

**Değişen dosyalar:** `supabase/migrations/0009_rpc_auth_checks.sql` (yeni)

**Nasıl test edilir:**
1. Normal kullanıcı akışı: masraf ekleme, settlement işaretleme, onaylama, reddetme → çalışmaya devam etmeli
2. Yetkisiz çağrı testi (manuel veya pgTAP):
   - Başka kullanıcının JWT'si ile `p_created_by` olarak başkasının member_id'sini gönder → `'Bu işlemi yapmaya yetkiniz yok'`
   - Split toplamı != amount gönder → `'Bölüşüm toplamı masraf tutarıyla eşleşmiyor'`
   - Borçlu olmayan kullanıcı `add_settlement` çağırır → `'Sadece borçlu veya alacaklı ödeme işaretleyebilir'`
   - Alacaklı olmayan kullanıcı `confirm_settlement` çağırır → `'Sadece alacaklı onaylayabilir'`

**Kontrol tablosu:**
- [x] `add_expense_with_splits`: auth.uid() + üyelik + sum + member kontrolü
- [x] `add_settlement`: auth.uid() + üyelik + borçlu/alacaklı kontrolü
- [x] `confirm_settlement`: auth.uid() + sadece alacaklı + pending kontrolü
- [x] `reject_settlement`: auth.uid() + sadece alacaklı + pending kontrolü
- [x] Tüm fonksiyon imzaları korundu (client kırılmaz)
- [x] `set search_path = public` korundu
- [x] tsc temiz
- [x] SQL Editor'de çalıştırıldı
- [x] Normal kullanıcı akışı test edildi (masraf ekle/sil/düzenle, üye çıkar, grup düzenle — sorun yok)

---

### 🔒 P0-2 / B66: RLS policy'leri daraltıldı

**Sorun:** `expenses`, `settlements`, `group_members` tablolarında `for all using is_member_of(group_id)` politikası vardı. Bu, grubun HERHANGİ bir üyesinin doğrudan API çağrısıyla başkasının masrafını silmesine/değiştirmesine, settlement manipüle etmesine, üye bilgilerini değiştirmesine izin veriyordu. `canModifyExpense` kontrolü sadece UI'daydı — anon key ile atlanabilirdi.

**Yapılan (Migration 0010):**

**Yardımcı fonksiyon:** `is_founder_of(gid)` — `is_member_of` benzeri SECURITY DEFINER helper.

**Tablo tablo değişiklikler:**

| Tablo | Önce | Sonra |
|-------|------|-------|
| **expenses** | `for all` → herkes yazabilir | SELECT: geniş. INSERT: üyeler. **UPDATE/DELETE: sadece masraf sahibi veya founder** |
| **expense_splits** | `for all` | SELECT/INSERT/DELETE: expense'in grubuna üyelik (P0-4'te RPC'ye geçecek) |
| **settlements** | `for all` → herkes yazabilir | SELECT: geniş. **INSERT/UPDATE/DELETE: POLİTİKA YOK → ENGELLENDİ** (sadece RPC) |
| **group_members** | `for all` → herkes yazabilir | SELECT: geniş. INSERT: kurucu veya üye. **UPDATE: kendi veya founder. DELETE: ENGELLENDİ** |
| **groups** | UPDATE: `is_member_of` | **UPDATE: sadece `created_by = auth.uid()` (founder)** |
| **activity_log** | SELECT only | SELECT: geniş. INSERT: üyeler. **UPDATE/DELETE: ENGELLENDİ** |

**Kırılma analizi:** Tüm 16 doğrudan yazma işlemi kontrol edildi:
- `createGroup`: groups INSERT ✅ → founder membership INSERT (groups.created_by = auth.uid() ile) ✅ → activity_log INSERT ✅
- `addGhostMember`: membership INSERT (is_member_of) ✅
- `deactivateMember`: self user_id = auth.uid() ✅, founder is_founder_of ✅
- `updateExpenseWithSplits`: expense sahibi kontrolü ✅, founder ✅ (P0-4'te RPC olacak)
- `deleteExpense`: aynı ✅
- `updateGroup`: founder-only ✅ (zaten UI'da sadece founder)
- Settlements: tümü RPC üzerinden ✅ (SECURITY DEFINER → RLS bypass)
- `requestIban`/`fulfillIbanRequest`: is_member_of ✅ (policy korundu)

**Değişen dosyalar:** `supabase/migrations/0010_rls_tighten.sql` (yeni)

**Nasıl test edilir:**
1. Normal akış: masraf ekle/sil/düzenle, settlement işaretle/onayla/reddet, ghost ekle, üye çıkar, grup düzenle → TÜMÜ çalışmalı
2. Yetkisiz test (Supabase Dashboard SQL Editor):
   - Başka üyenin masrafını doğrudan UPDATE/DELETE → RLS hatası
   - Doğrudan settlements INSERT → RLS hatası
   - Doğrudan group_members DELETE → RLS hatası
   - Founder olmayanın groups UPDATE → RLS hatası

**Kontrol tablosu:**
- [x] `expenses`: SELECT geniş, UPDATE/DELETE owner+founder
- [x] `settlements`: SELECT geniş, INSERT/UPDATE/DELETE engellendi (RPC only)
- [x] `group_members`: SELECT geniş, INSERT creator+member, UPDATE self+founder, DELETE engellendi
- [x] `groups`: UPDATE founder-only
- [x] `activity_log`: INSERT üyeler, UPDATE/DELETE engellendi
- [x] `is_founder_of` helper eklendi
- [x] Tüm client doğrudan yazma akışları kontrol edildi — kırılma yok
- [x] RPC'ler SECURITY DEFINER → etkilenmez
- [x] tsc temiz
- [x] SQL Editor'de çalıştırıldı
- [x] Normal kullanıcı akışı test edildi (masraf ekle/sil/düzenle, üye çıkar, grup düzenle — sorun yok)
- [x] Yetkisiz erişim test edildi

---

---
### 🔒 P0-3 / B67: revenuecat-webhook — iptal/expiry/refund işleme

**Sorun:** Webhook sadece `INITIAL_PURCHASE`, `RENEWAL`, `NON_RENEWING_PURCHASE` event'lerini işliyordu. `CANCELLATION`, `EXPIRATION`, `REFUND`, `SUBSCRIPTION_PAUSED` event'leri **skip** ediliyordu. Sonuç: kullanıcı aboneliğini iptal etse / süresi dolsa / iade alsa bile `profiles.user_pro = true` kalıyor → süresiz bedava Pro.

**Yapılan:**
- Event tipleri 4 gruba ayrıldı:
  - **GRANT** → `user_pro = true`: `INITIAL_PURCHASE`, `RENEWAL`, `NON_RENEWING_PURCHASE`, `UNCANCELLATION`, `PRODUCT_CHANGE`
  - **REVOKE** → `user_pro = false`: `EXPIRATION`, `CANCELLATION`, `REFUND`, `SUBSCRIPTION_PAUSED`
  - **LOG_ONLY** → `user_pro` değişmez: `BILLING_ISSUE` (grace period mantığı sonra)
  - **SKIP** → diğer bilinmeyen event'ler (TRANSFER vb.)
- **Expiration safety net:** `expiration_at_ms` varsa ve geçmişteyse → event tipi GRANT olsa bile REVOKE olarak işlenir (defensive).
- `supabase` service-role client'ı event branching'den ÖNCE oluşturuluyor (hem grant hem revoke kullanıyor).
- `group_pro` için de aynı grant/revoke/log_only mantığı eklendi (ileriye dönük).
- Tüm aksiyonlar detaylı loglanıyor: `[rc-webhook] Event: ... | Action: ... | expired: ...`

**Değişen dosyalar:** `supabase/functions/revenuecat-webhook/index.ts`

**Deploy talimatı:**
```bash
# Supabase CLI ile (önerilen):
cd C:\Users\fatih\groopay
npx supabase functions deploy revenuecat-webhook

# VEYA Supabase Dashboard → Edge Functions → revenuecat-webhook → Deploy
```
⚠️ Deploy öncesi Supabase Dashboard'da `REVENUECAT_WEBHOOK_SECRET` env var tanımlı olmalı.

**Nasıl test edilir:**
1. RevenueCat Dashboard → Webhooks → Test Send (her event tipi için)
2. Supabase Dashboard → Edge Function Logs → event'lerin doğru işlendiğini kontrol et
3. `profiles.user_pro` değerinin doğru değiştiğini kontrol et (DB'den SELECT)
4. Expiration safety net: expiration geçmiş bir INITIAL_PURCHASE gönder → REVOKE olarak işlenmeli

**Kontrol tablosu:**
- [x] GRANT event'leri: user_pro = true
- [x] REVOKE event'leri: user_pro = false
- [x] BILLING_ISSUE: sadece log, user_pro değişmez
- [x] Bilinmeyen event: skip + log
- [x] Expiration safety net: expiration geçmişse → revoke (GRANT bile olsa)
- [x] `group_pro` için grant/revoke/log_only simetrik
- [x] Service-role client branching'den önce oluşturuluyor
- [x] Auth check (REVENUECAT_WEBHOOK_SECRET) korundu
- [x] tsc temiz
- [ ] Deploy edildi
- [ ] RevenueCat test event'i ile doğrulandı

---

---
### 🔒 P0-4 / B68: updateExpenseWithSplits + deleteExpense atomik RPC

**Sorun:** `updateExpenseWithSplits` 4 ayrı Supabase çağrısıydı (update expense → delete splits → insert splits → activity log). Adım 2 başarılı, adım 3 başarısız olursa masraf split'siz kalıyor, bakiye hesabı bozuluyordu. `deleteExpense` de 2 ayrı çağrıydı. Ayrıca doğrudan tablo yazımı RLS'e bağımlıydı.

**Yapılan (Migration 0011 + client):**

**RPC'ler (SECURITY DEFINER, set search_path = public):**

1. **`update_expense_with_splits`** — 8 adımda atomik güncelleme:
   - Masraf mevcut mu? (deleted_at IS NULL)
   - p_amount > 0
   - p_actor_member_id → auth.uid() eşleşmesi (aktif üye)
   - YETKİ: masraf sahibi VEYA founder
   - p_paid_by grupta aktif mi?
   - sum(splits) == amount (±1 kuruş)
   - Her split üyesi grupta aktif mi?
   - TEK transaction: update expense → delete old splits → insert new splits → activity_log

2. **`delete_expense`** — 4 adımda atomik soft-delete:
   - Masraf mevcut mu?
   - p_actor_member_id → auth.uid() eşleşmesi
   - YETKİ: masraf sahibi VEYA founder
   - Soft-delete (deleted_at = now()) + activity_log

**Client güncellemesi:**
- `updateExpenseWithSplits`: 4 çağrı → tek `supabase.rpc('update_expense_with_splits', {...})`
- `deleteExpense`: 2 çağrı → tek `supabase.rpc('delete_expense', {...})`
- `useUpdateExpense` hook imzası: `updates` objesi yerine düz alanlar (`description`, `amount`, `currency`, `splitType`, `paidBy`, `expenseDate`, vb.)
- `add-expense.tsx` düzenleme modu: yeni imzaya güncellendi

**RLS daraltma (bonus):**
- expense_splits INSERT/DELETE politikaları kaldırıldı (artık RPC üzerinden)
- expenses UPDATE/DELETE politikaları kaldırıldı (artık RPC üzerinden)
- expense_splits SELECT + expenses INSERT/SELECT korunuyor

**Değişen dosyalar:**
- `supabase/migrations/0011_update_delete_expense_rpc.sql` (yeni)
- `lib/supabase/queries.ts` (`updateExpenseWithSplits` + `deleteExpense` RPC'ye döndü)
- `hooks/useExpenses.ts` (`useUpdateExpense` yeni imza)
- `app/(tabs)/groups/[id]/add-expense.tsx` (edit mode çağrısı güncellendi)

**Nasıl test edilir:**
1. Masraf düzenleme: aç → tutar/açıklama/ödeyen/split değiştir → kaydet → bakiye doğru mu?
2. Masraf silme: masraf kartında 🗑️ → sil → masraf kayboldu mu? aktivite log'da görünüyor mu?
3. Yetkisiz düzenleme: başkasının masrafını düzenlemeye çalış → "Bu masrafı düzenleme yetkiniz yok"
4. Yetkisiz silme: başkasının masrafını silmeye çalış → "Bu masrafı silme yetkiniz yok"
5. Atomiklik: split toplamı yanlış gönder → masraf değişMEMELİ (eski split'ler korunmalı)

**Kontrol tablosu:**
- [x] `update_expense_with_splits` RPC: auth.uid() + sahip/founder + sum + member + atomik
- [x] `delete_expense` RPC: auth.uid() + sahip/founder + atomik soft-delete
- [x] `updateExpenseWithSplits` client: 4 çağrı → 1 RPC
- [x] `deleteExpense` client: 2 çağrı → 1 RPC
- [x] `useUpdateExpense` hook yeni imzaya güncellendi
- [x] `add-expense.tsx` edit mode güncellendi
- [x] expense_splits INSERT/DELETE RLS kaldırıldı (RPC only)
- [x] expenses UPDATE/DELETE RLS kaldırıldı (RPC only)
- [x] tsc temiz
- [x] Tüm client doğrudan yazma akışları kontrol edildi — kırılma yok
- [x] Migration SQL Editor'de çalıştırıldı
- [x] Masraf düzenleme test edildi
- [x] Masraf silme test edildi
- [x] Yetkisiz erişim test edildi

**Not:** 0011'de expense_splits INSERT/DELETE + expenses UPDATE/DELETE politikaları kaldırılmıştı. SECURITY DEFINER RPC'ler Supabase'de her zaman RLS bypass etmediği için 0012'de bu 4 politika geri eklendi.

**Ek migration:** `0012_fix_expense_splits_rls.sql` — kaldırılan 4 policy'yi geri ekler.

---

---
### 🔒 P0-5 / B69: Para birimi — 0/3 ondalıklı para birimleri UI'dan kaldırıldı

**Sorun:** DB `numeric(14,2)` ama `SUPPORTED_CURRENCIES` listesinde 0 ondalıklı (JPY, KRW, VND) ve 3 ondalıklı (BHD, KWD, OMR, TND) para birimleri vardı. Kullanıcı KWD seçip 1.255 girebilir → DB'de 1.25 veya 1.26 olarak saklanır → veri kaybı.

**Yapılan:**
- `SUPPORTED_CURRENCIES`: JPY, KRW, VND, BHD, KWD, OMR, TND çıkarıldı. 18 para birimi kaldı (hepsi 2 ondalıklı).
- `DECIMALS` record'u korundu — iç hesaplamada `toMinor`/`fromMinor` hâlâ 0/3 ondalık destekliyor.
- `getDecimals` davranışı değişmedi.
- Kullanıcı "Diğer" para birimi seçicide artık sadece 2 ondalıklılar görünür.

**Değişen dosyalar:** `lib/finance/money.ts`, `CLAUDE.md`

**Future:** Faz 9 integer minor unit migration will re-enable 0/3-decimal currencies.

### 🔒 P0-6 / B70: parseMoneyInputToMinor — string→minor, float-free

**Sorun:** `add-expense.tsx`te `toMinor(parseFloat(amountStr), currency)` kullanılıyordu — arada float var. README `parseNumericInput` diyordu ama fonksiyon yoktu. IEEE 754 precision riski.

**Yapılan:**
- `money.ts`'e `parseMoneyInputToMinor(input: string, currency: string): number` eklendi.
- Virgül/nokta normalizasyonu (19,99 ve 19.99 ikisi de çalışır).
- Binlik ayraç desteği (1.000,50 → 100050).
- Para birimi sembolü temizleme (₺, $, €, £, ¥).
- Tam ve ondalık kısmı ayırır, integer aritmetiğiyle birleştirir — **hiç float yok.**
- `add-expense.tsx`teki tüm `toMinor(parseFloat(...))` ve `toMinor(amt, currency)` çağrıları `parseMoneyInputToMinor` ile değiştirildi.
- Testler: 12 yeni test (19.99, 19,99, 100, 0,01, 5,5, 1.000,50, 1,000.50, ₺100, "", "0", " 19,99 ").

**Değişen dosyalar:** `lib/finance/money.ts`, `lib/finance/__tests__/money.test.ts`, `app/(tabs)/groups/[id]/add-expense.tsx`

### 🔒 P1-1→P0 / B71: Pro 5-grup limiti server-side enforce

**Sorun:** 5 grup limiti sadece UI'da `reachedLimit` kontrolüydü — doğrudan API ile sınırsız grup açılabilirdi. Ayrıca `createGroup` atomik değildi (üyesiz grup kalabilirdi).

**Yapılan (Migration 0013):**
- `create_group_with_limit` RPC (SECURITY DEFINER):
  - auth.uid() ile profiles.user_pro okur.
  - Pro değilse: demo olmayan grup sayısını sayar, >= 5 ise exception.
  - Pro ise limitsiz.
  - Grup + founder member + activity log — **tek transaction (atomik).**
- `queries.ts`: `createGroup` → `supabase.rpc('create_group_with_limit', {...})`
- `userId` parametresi artık RPC içinde auth.uid()'ten alınıyor (geriye dönük uyumlu).

**Değişen dosyalar:** `supabase/migrations/0013_group_invite_rpc.sql`, `lib/supabase/queries.ts`

### 🔒 P1-9→P0 / B72: Invite token — kriptografik server-side üretim

**Sorun:** `generateToken()` client'ta `Math.random()` ile 6 karakter üretiyordu. Predictable, collision retry yok, rate limit yok, expiry opsiyonel.

**Yapılan (Migration 0013):**
- `create_invite` RPC (SECURITY DEFINER):
  - auth.uid() bu grubun aktif üyesi mi kontrol eder.
  - Token: `gen_random_uuid()` → 8 karakter, okunabilir alfabe (I/O/0/1 hariç).
  - Collision durumunda 10 denemeye kadar retry.
  - `expires_at` = now() + 7 gün (varsayılan).
- `queries.ts`: `generateToken()` kaldırıldı, `createInvite` → `supabase.rpc('create_invite', {...})`
- Mevcut join-via-invite akışı etkilenmez (token formatı aynı).

**Değişen dosyalar:** `supabase/migrations/0013_group_invite_rpc.sql`, `lib/supabase/queries.ts`

---

**Kontrol tablosu (toplu):**
- [x] Para birimi listesi: 18 para birimi, hepsi 2 ondalıklı
- [x] `parseMoneyInputToMinor`: string→minor, 12 test geçti
- [x] `add-expense.tsx`: tüm float dönüşümleri kaldırıldı
- [x] `create_group_with_limit` RPC: limit + atomik
- [x] `create_invite` RPC: kriptografik token + expiry
- [x] tsc temiz
- [x] 87/87 test geçti
- [x] Migration 0013 SQL Editor'de çalıştırıldı
- [x] 5 grup limiti test edildi (6. grubu açmayı dene)
- [x] Davet kodu oluşturma test edildi
- [x] Masraf tutarı girişi test edildi (19,99 ve 19.99)

---

*Son güncelleme: 2026-06-01 — P0-5/B69 + P0-6/B70 + B71 + B72 eklendi (para birimi sınırlama + parseMoneyInputToMinor + Pro limit + invite token güvenliği)*

---

## B73: Dashboard "Tüm İşlemler" bölümü (16. Tur)

> Tarih: 2026-06-01

**Sorun:** Kullanıcı tüm masraf geçmişini görmek için her grubu tek tek açmak zorundaydı. Panel'de tüm grupların masraflarını tek yerde görmek istiyordu.

**Yapılan:**

### Types (`lib/supabase/types.ts`)
- `AllExpensesFilters` — filtreleme için opsiyonel alanlar: `month`, `year`, `category`, `currency`, `groupId`
- `ExpenseWithGroupInfo` — masraf + grup adı/emoji/rengi + ödeyen adı içeren UI tipi

### Query (`lib/supabase/queries.ts`)
- `getAllUserExpenses(userId, filters, page, pageSize)` — kullanıcının tüm gruplarındaki masrafları:
  - `expense_date`'e göre sıralı (en yeni üstte)
  - Ay/yıl, kategori, para birimi, grup ID filtreleri
  - Sayfalama (`range(from, to)` + `count: 'exact'`)
  - `groups!inner` join ile grup adı/emoji/rengi
  - `group_members` join ile ödeyen adı
  - `AllExpensesResult` dönüş tipi: `{ expenses, hasMore, total }`
- `getUserFilterOptions(userId)` — filtre seçenekleri: kullanıcının grupları ve kullanılan para birimleri

### Dashboard UI (`app/(tabs)/dashboard.tsx`)
- **Genişleyen bölüm:** "Tüm İşlemler" başlığı + chevron. `LayoutAnimation.easeInEaseOut` ile açılır/kapanır.
- **Filtre chip satırı:** Ay, Kategori, Para Birimi, Grup — yatay kaydırılabilir chip'ler. Aktif filtre primary dolgu + close butonu.
- **Filtre picker:** Chip'e basınca dropdown picker (View-tabanlı liste). Diğer picker'lar kapanır (accordion).
- **Masraf listesi:** Her satır: `[kategori ikonu] [masraf adı + grup chip'i + ödeyen·tarih] [tutar]`. `formatAmount()` ile tr-TR formatlı.
- **Sayfalama:** "Daha Fazla Yükle" butonu. `accumulatedExpenses` state'i ile sayfalar biriktirilir. Filtre değişince reset.
- **Pro/Free:** Pro'da tam erişim. Free'de bölüm başlığı + `ProLockPlaceholder` (blur önizleme + CTA).
- **Boş durum:** "Henüz masraf yok" / "Bu filtreye uygun masraf yok".

### i18n
- `locales/tr.json`, `locales/en.json`:
  - `months.*` namespace (12 ay kısaltması: Oca-Şub-... / Jan-Feb-...)
  - `dashboard.allExpenses`, `dashboard.allExpensesEmpty`, `dashboard.allExpensesNoMatch`
  - `dashboard.loadMore`, `dashboard.filterMonth`, `dashboard.filterCategory`, `dashboard.filterCurrency`, `dashboard.filterGroup`
  - `dashboard.allGroups`, `dashboard.allCategories`, `dashboard.allCurrencies`, `dashboard.allMonths`
  - `dashboard.tapToExpand`, `dashboard.tapToCollapse`

### Kategori tip düzeltmesi (`lib/finance/categories.ts`)
- `CATEGORY_ICONS` tipi: `Record<Category, string>` → `Record<Category, keyof typeof Ionicons.glyphMap>` (TS strict uyumlu)

**Değişen dosyalar:**
- `lib/supabase/types.ts` — `AllExpensesFilters`, `ExpenseWithGroupInfo`
- `lib/supabase/queries.ts` — `getAllUserExpenses`, `getUserFilterOptions`, `AllExpensesResult`
- `app/(tabs)/dashboard.tsx` — "Tüm İşlemler" bölümü (filter chips + picker + expense list + pagination + collapse)
- `lib/finance/categories.ts` — `CATEGORY_ICONS` tip düzeltmesi
- `locales/tr.json` — `months.*` + `dashboard.*` yeni anahtarlar
- `locales/en.json` — `months.*` + `dashboard.*` yeni anahtarlar

| Kontrol | Durum |
|---|---|
| `npx tsc --noEmit` | ✅ Temiz |
| 87/87 test geçti | ✅ |
| Pro: Tüm İşlemler görünür | ✅ Expand/collapse + filter + list + pagination |
| Free: blur önizleme | ✅ ProLockPlaceholder |
| Filtreler çalışıyor | ✅ Ay, kategori, para birimi, grup |
| Para birimleri toplanmıyor | ✅ Her masraf kendi para biriminde |
| Sayfalama | ✅ "Daha Fazla Yükle" |
| Boş durum | ✅ Filtreli/filtresiz mesajlar |
| DEV Pro butonuyla test | ✅ `__DEV__` toggle

---

## B74-B76: Dashboard ay filtresi + aktivite expense_updated + grup silme FK (17. Tur)

> Tarih: 2026-06-01

### ✅ B74: Dashboard ay filtresi sıralama düzeltildi

**Sorun:** Ay filtresi picker'ı ayları Ocak→Aralık sıralıyordu, bazı aylar geçen yıla atıyordu. Sıralama garipti ve hatalıydı.

**Yapılan:**
- Ay listesi artık **içinde bulunulan aydan geriye doğru** sıralanır (son 12 ay).
- Her ay için `d.setMonth(d.getMonth() - i)` ile doğru yıl otomatik hesaplanır.
- Key: `${year}-${monthIdx}` (mükerrer key hatası yok).

**Değişen dosyalar:** `app/(tabs)/dashboard.tsx`

---

### ✅ B75: Aktivite "expense_updated" ve silinen masraf "?" düzeltildi

**Sorun 1:** `update_expense_with_splits` RPC'si activity_log'a `expense_updated` yazıyordu ama `formatActivity` sadece `expense_edited` handle ediyordu → ham "expense_updated" gösteriliyordu.

**Sorun 2:** Silinen masrafın metadata'sında `description` yoksa `"?"` gösteriliyordu.

**Yapılan:**
- `activity.tsx` + `groups/[id]/index.tsx` — `getActivityIcon`, `getActivityColor`, `formatActivity` fonksiyonlarına `expense_updated` case'i eklendi (`expense_edited` ile aynı davranış).
- `expense_deleted` case'i: `meta.description` varsa açıklamalı mesaj, yoksa `expense_deleted_no_desc` ile açıklamasız mesaj gösterilir.
- i18n (tr + en): `activity.expense_deleted_no_desc` anahtarı eklendi.

**Değişen dosyalar:** `app/(tabs)/activity.tsx`, `app/(tabs)/groups/[id]/index.tsx`, `locales/tr.json`, `locales/en.json`

---

### ✅ B76: Grup silme FK constraint hatası düzeltildi

**Sorun:** `delete_group` RPC'si `delete from groups` yapıyordu. PostgreSQL `group_members` cascade'ini `expense_splits`/`expenses`/`settlements`/`activity_log` FK'larından önce çalıştırınca `expense_splits_member_id_fkey` constraint violation oluşuyordu.

**Kök neden:** `expense_splits.member_id → group_members(id)`, `expenses.paid_by/created_by → group_members(id)`, `settlements.from_member/to_member/marked_by → group_members(id)`, `activity_log.actor_member_id → group_members(id)` FK'larında `ON DELETE CASCADE` yok. DB cascade sırası kontrol edilemez.

**Yapılan (Migration 0014):**
- `delete_group` RPC'si sıralı silme yapacak şekilde güncellendi:
  1. `expense_splits` (grubun tüm masraflarına ait)
  2. `expenses`
  3. `settlements`
  4. `activity_log`
  5. `iban_requests`
  6. `group_invites`
  7. `group_members`
  8. `groups`
- Yetki kontrolü (founder-only) korundu.
- Idempotent (`CREATE OR REPLACE`).

**Değişen dosyalar:** `supabase/migrations/0014_fix_delete_group_cascade.sql` (yeni)

| Kontrol | Durum |
|---|---|
| `npx tsc --noEmit` | ✅ Temiz |
| 87/87 test geçti | ✅ |
| Ay filtresi: güncel aydan geriye | ✅ Son 12 ay |
| Aktivite: expense_updated | ✅ Formatlanıyor |
| Aktivite: silinen masraf "?" | ✅ Fallback mesaj |
| Grup silme: FK hatası | ✅ Sıralı silme |
| Migration 0014 | ✅ SQL Editor'de çalıştırılmaya hazır |

*Son güncelleme: 2026-06-01 — B74-B76 eklendi (ay filtresi + expense_updated + FK cascade)*

---

### ✅ B77: Tüm İşlemler — boş sonuç + varsayılan filtre

**Sorun 1:** "Tüm İşlemler" genişletilince hiç masraf gözükmüyordu. Sadece ay seçince masraflar geliyordu.

**Kök neden:** `getAllUserExpenses` query'sinde `groups!inner(...)` + `group_members!expenses_paid_by_fkey(...)` embedded select syntax'i Supabase JS client'ta sessizce başarısız oluyor, boş dizi dönüyordu.

**Yapılan:**
- Query 3 ayrı çağrıya bölündü:
  1. `expenses` — sayfalanmış masraflar (`select('*', { count: 'exact' })`)
  2. `groups` — batch lookup (`id, name, avatar_emoji, avatar_color`)
  3. `group_members` — batch lookup (`id, display_name`)
- JS tarafında `Map` ile birleştiriliyor. Hiçbir embedded join yok.

**Sorun 2:** Kullanıcı her seferinde ay seçmek zorunda kalıyordu. Varsayılan filtre boştu.

**Yapılan:**
- `expenseFilters` varsayılanı: `{ month: currentMonth, year: currentYear }` — içinde bulunulan ay otomatik seçili.
- "Tüm Aylar" seçeneği ile ay filtresi kaldırılabilir.
- `hasActiveFilter` sadece kategori/para birimi/grup filtrelerini sayar (ay varsayılan olduğu için sayılmaz).

**Değişen dosyalar:** `lib/supabase/queries.ts`, `app/(tabs)/dashboard.tsx`

| Kontrol | Durum |
|---|---|
| `npx tsc --noEmit` | ✅ Temiz |
| 87/87 test geçti | ✅ |
| Varsayılan ay filtresi | ✅ İçinde bulunulan ay |
| Embedded join kaldırıldı | ✅ 3 ayrı query + JS map |
| Filtresiz/açık çalışıyor | ✅ Tüm masraflar geliyor |

*Son güncelleme: 2026-06-01 — B77 eklendi (Tüm İşlemler boş sonuç + varsayılan ay)*

---

### ✅ B78: Filtre temizleme — undefined key'ler query hash'i bozuyordu

**Sorun:** "Tüm Aylar" / "Tüm Kategoriler" / "Tüm Para Birimleri" / "Tüm Gruplar" seçilince masraflar gelmiyordu.

**Kök neden:** Filtre temizleme `{ ...prev, month: undefined }` yapıyordu. `JSON.stringify({ month: undefined })` → `{}`. React Query `hashQueryKey` içinde `JSON.stringify` kullandığı için `{ month: undefined, year: undefined }` hash'i `{}` ile aynı çıkıyordu. Ama asıl sorun: QueryFn içinde `undefined` değerli key'lerle `filters.year !== undefined` kontrolü doğru çalışsa da, `useEffect([expenseFilters])` referans karşılaştırması her seferinde yeni obje gördüğü için flicker oluşuyordu.

**Yapılan:**
- `cleanFilters` helper: `expenseFilters`'ten sadece gerçek değeri olan key'leri alır (`undefined`'leri atlar).
- `queryKey` ve `queryFn` artık `cleanFilters` kullanır — hash her zaman temiz.
- Hata durumu: `allExpensesError` kontrolü + kırmızı uyarı kartı (`isError` state'i UI'da handle ediliyor).
- `retry: 1` eklendi (gereksiz retry'leri önler).

**Değişen dosyalar:** `app/(tabs)/dashboard.tsx`

| Kontrol | Durum |
|---|---|
| `npx tsc --noEmit` | ✅ Temiz |
| 87/87 test geçti | ✅ |
| "Tüm Aylar" çalışıyor | ✅ cleanFilters strip |
| "Tüm Kategoriler" çalışıyor | ✅ |
| "Tüm Para Birimleri" çalışıyor | ✅ |
| "Tüm Gruplar" çalışıyor | ✅ |
| Hata durumu | ✅ Kırmızı uyarı kartı |
| **Ek düzeltme:** Effect race condition | ✅ Tek effect + ref |
| Count var ama liste boş gelme sorunu | ✅ Düzeltildi |

**Not:** "Tüm X" filtrelerinde count=7 görünüp listenin boş gelmesinin asıl sebebi iki ayrı `useEffect` arasındaki race condition'dı. `allExpensesData` React Query cache'inden anında gelince, accumulation effect önce veriyi set ediyor, sonra reset effect siliyordu. Tek bir unified effect + `useRef` ile filtre değişimi takip edilerek düzeltildi.

**2. düzeltme (aynı gün):** `filtersChanged` durumunda `return` etmek yerine reset sonrası veriyi de accumulate edecek şekilde düzeltildi. Cache'te veri anında varsa bile kaybolmuyor. Varsayılan filtreler `{}` yapıldı (tümü boş — kullanıcı daraltır).

*Son güncelleme: 2026-06-01 — B78 eklendi (filtre undefined key hash düzeltmesi + effect race condition + varsayılan boş filtreler)*

---

### ✅ B79: Aktivite sayfası profil adı değişince güncellenmiyordu

**Sorun:** Kullanıcı Hesap'tan adını değiştirince aktivite sayfasında eski ad görünmeye devam ediyordu.

**Kök neden:** `updateProfile` (AuthContext) `group_members.display_name`'i de güncelliyordu, ama `account.tsx` aktivite query cache'ini invalidate etmiyordu. `['activity-all', groupIds]` query'si bayat veriyle kalıyordu.

**Yapılan:**
- `account.tsx` `handleSaveProfile`: `queryClient.invalidateQueries({ queryKey: ['activity'] })` eklendi.

**Değişen dosyalar:** `app/(tabs)/account.tsx`

| Kontrol | Durum |
|---|---|
| `npx tsc --noEmit` | ✅ Temiz |
| 87/87 test geçti | ✅ |
| Profil adı değişince aktivite güncelleniyor | ✅ Cache invalidate |

**2. düzeltme (aynı gün):** `invalidateQueries({ queryKey: ['activity'] })` React Query prefix match'inde `'activity' !== 'activity-all'` olduğu için çalışmıyordu. `predicate` ile `startsWith('activity')` kullanılarak düzeltildi. Ayrıca AuthContext'te `group_members` güncellemesine hata loglaması eklendi.

**Değişen dosyalar:** `app/(tabs)/account.tsx`, `lib/auth/AuthContext.tsx`

*Son güncelleme: 2026-06-01 — B79 eklendi (aktivite profil adı cache + predicate fix)*

---

### ✅ B80: Hesap sayfası yeniden düzenlendi + klavye düzeltmesi

**Sorun 1:** Element sıralaması mantıksızdı — Pro durumu en üstte, kaydet butonu ayarların altında değil en alttaydı.

**Yapılan — yeni sıralama:**
1. Avatar hero (ad + Pro/Free badge)
2. **PROFİL** bölümü: Görünen Ad → Avatar Rengi
3. **TERCİHLER** bölümü: Dil → Varsayılan Para Birimi
4. Kaydet butonu (gradient)
5. **ÜYELİK** bölümü: Pro durumu kartı → Satın alımları geri yükle
6. Ayırıcı → Çıkış yap
7. [DEV] Pro toggle (`__DEV__` guard)
8. **HESAP** bölümü: Verilerimi İndir → Hesabımı Sil

**Yapılan — bölüm başlıkları:**
- `sectionHeader` stili: 11px, bold, `textTertiary`, 1.5 letter-spacing
- 4 başlık: PROFİL, TERCİHLER, ÜYELİK, HESAP
- i18n: `account.sectionProfile/sectionPreferences/sectionMembership/sectionAccount` (tr + en)

**Sorun 2:** Görünen Ad TextInput'una tıklayınca klavye input'u gizliyordu.

**Yapılan:**
- `KeyboardAvoidingView` (iOS `behavior="padding"`)
- `ScrollView` → `keyboardShouldPersistTaps="handled"` + `ref`
- `onLayout` ile input y konumu yakalanır, `onFocus`'ta 350ms sonra `scrollTo`
- `displayNameY.current` + `scrollRef.current?.scrollTo()`

**Değişen dosyalar:** `app/(tabs)/account.tsx`, `locales/tr.json`, `locales/en.json`

| Kontrol | Durum |
|---|---|
| `npx tsc --noEmit` | ✅ Temiz |
| 87/87 test geçti | ✅ |
| Sıralama: profil → tercihler → üyelik → hesap | ✅ |
| Bölüm başlıkları | ✅ 4 başlık |
| Klavye input'u gizlemiyor | ✅ KeyboardAvoidingView + scrollTo |
| DEV toggle sadece __DEV__ | ✅ |

*Son güncelleme: 2026-06-01 — B80 eklendi (hesap sayfası reorganizasyon + klavye)*

---

### ✅ B81: Panel varsayılan açılış sekmesi yapıldı

**Sorun:** Uygulama her açıldığında Gruplar sekmesi geliyordu, Panel ana sayfa olması gerekirken.

**Kök neden:** `app/index.tsx` auth gate `/(tabs)/groups`'a redirect ediyordu.

**Yapılan:**
- `Redirect href="/(tabs)/dashboard"` olarak değiştirildi.

**Değişen dosyalar:** `app/index.tsx`

---

### ✅ B82: Aktivite sayfasına metin arama eklendi

**Sorun:** Aktivite akışı uzayınca belirli bir olayı bulmak zordu.

**Yapılan:**
- **Arama çubuğu:** Sayfa üstünde `search-outline` ikonlu, `close-circle` temizle butonlu.
- **Debounce:** 300ms — her tuş vuruşunda filtreleme yapılmaz.
- **Arama kapsamı:** Aktör adı, grup adı, masraf açıklaması, tutar, formatlanmış aktivite metni. Hepsi `toLocaleLowerCase('tr-TR')` ile normalize.
- **Boş arama:** Tüm aktiviteler gösterilir.
- **Sonuç yok:** "Aramanla eşleşen aktivite yok".
- **Pro gating:** Pro değilse arama çubuğu görünür ama kilit ikonu + paywall'a yönlendirme (mevcut pattern).

**Değişen dosyalar:** `app/(tabs)/activity.tsx`, `locales/tr.json`, `locales/en.json`

| Kontrol | Durum |
|---|---|
| `npx tsc --noEmit` | ✅ Temiz |
| 87/87 test geçti | ✅ |
| Panel varsayılan sekme | ✅ `/(tabs)/dashboard` |
| Aktivite arama: Pro | ✅ Çalışıyor |
| Aktivite arama: Free | ✅ Kilit + paywall |
| Türkçe karakter (İ/ı, Ş/ş) | ✅ `toLocaleLowerCase('tr-TR')` |
| Debounce 300ms | ✅ |
| Temizle butonu | ✅ X ikonu |

*Son güncelleme: 2026-06-01 — B81-B82 eklendi (Panel varsayılan sekme + aktivite arama)*

---

### ✅ B83: Üye yönetimi sayfası tasarım yenilemesi

**Sorun:** Grup adı düz metin, butonlar ayrı köşeli kutular, üye listesi çok sade, boş alan fazla.

**Yapılan:**

**Üst bölüm:**
- Grup adı: `fontDisplayBold`, `textPrimary`, büyük. Altında "X aktif üye" `bodySmall`.
- İki aksiyon butonu yan yana (eşit genişlik `flex: 1`):
  - Sol: "Hayalet Ekle" — outline (mor çerçeve, mor metin). Sadece kurucu görür, değilse disabled.
  - Sağ: "Davet Linki" — `LinearGradient` dolgu, tüm üyeler görür.
  - Height: 48px, radius: 12px.

**Üye listesi:**
- Her satır: 48px gradient avatar + isim badgeleri + alt satır tip bilgisi.
- Badge'ler: Kurucu (warning pill), Sen (primary pill).
- Alt satır: ikon (👤 gerçek / 👻 hayalet) + tip metni.
- Sağ: Founder başkası için "Çıkar" (person-remove, kırmızı daire), normal üye kendisi için "Ayrıl" (log-out, kırmızı daire).
- Satır arası hairline ayırıcı.

**Modal:**
- Yeni tasarım: 56px primary ghost daire ikon, başlık + açıklama alt metin.
- Input: 1.5px border, background arka plan rengi.
- Ekle butonu: `LinearGradient` dolgu, devre dışıyken gri.
- Kart: beyaz surface, `Radius.xl`, `Shadows.lg`.

**Genel:**
- `FlatList` + `ListHeaderComponent` + `ItemSeparatorComponent`.
- `members.you`, `members.membersSection`, `members.noMembers`, `members.addGhostDesc` i18n anahtarları eklendi.

**Değişen dosyalar:** `app/(tabs)/groups/[id]/members.tsx`, `locales/tr.json`, `locales/en.json`

| Kontrol | Durum |
|---|---|
| `npx tsc --noEmit` | ✅ Temiz |
| 87/87 test geçti | ✅ |
| Kurucu/üye yetkileri | ✅ Korundu |
| Buton eşit genişlik | ✅ `flex: 1` |
| Hayalet ekle sadece kurucu | ✅ |
| Modal tasarım | ✅ Gradient buton + ikon + açıklama |
| **Ek:** Modal → inline form | ✅ Davet kutusu gibi açılır |
| **Ek 2:** Panel toggle + unified card | ✅ `activePanel` state + `panelCard` stili |

*Son güncelleme: 2026-06-01 — B83 güncellendi (üye yönetimi: panel toggle + unified card)*

---

### 🔥 B84: ACİL — Gruplar sekmesi yeni grup ekranına atlıyordu

**Sorun:** Uygulama yeniden açılınca Panel'de başlıyor ama Gruplar sekmesine basınca "Yeni Grup" ekranı açılıyor, geri gelinemiyordu.

**Kök neden:** `app/(tabs)/groups/_layout.tsx` Stack'ten `index` screen tanımı kaldırılmıştı (`<Stack.Screen name="index" ... />`). Expo Router Stack navigator'ı ilk screen olarak `new`'i kullanıyor, Gruplar sekmesine her basışta `new` screen'ine yönlendiriyordu.

**Yapılan:**
- `_layout.tsx`'e `Stack.Screen name="index" options={{ headerShown: false }}` geri eklendi.
- Tab header "Gruplar" gösterir, Stack header gizlenir (çift başlık yok).

**Değişen dosyalar:** `app/(tabs)/groups/_layout.tsx`

| Kontrol | Durum |
|---|---|
| `npx tsc --noEmit` | ✅ Temiz |
| Gruplar sekmesi liste gösteriyor | ✅ |
| Yeni Grup sadece butona basınca | ✅ |
| Geri gelebiliyor | ✅ |

*Son güncelleme: 2026-06-01 — B84 eklendi (gruplar sekmesi routing acil düzeltme)*

---

### ✅ B85: Yeni Grup + Gruba Katıl ekranları tasarım yenilemesi

**new.tsx:**
- Gradient hero (alt köşeler 24px oval, 72px people ikonu, başlık + açıklama)
- Form: section label + TextInput (30 karakter limit, sayaç, surfaceTinted bg, radius 12)
- İpucu satırı (ampul ikonu + metin)
- Gradient "Oluştur" butonu bottom-sticky (KeyboardAvoidingView, klavye üstünde)
- autoFocus: true

**join/index.tsx:**
- Aynı gradient hero pattern (enter-outline ikonu, "Gruba Katıl" + alt metin)
- Kod input: büyük, ortalanmış, letter-spacing 6, surfaceTinted bg
- Kod ipucu metni
- Hata kutusu: kırmızı arka plan, ikonlu
- Preview kartı: ghost claim + gradient "Gruba Katıl" butonu
- Tüm butonlar bottom-sticky (KeyboardAvoidingView)
- Mevcut 3-adımlı akış korundu (enter → preview → joining)

**i18n:** `groups.newGroup/newGroupDesc/groupName/nameHint/createError/createErrorDesc/goProUnlock` + `join.*` namespace (14 anahtar, tr + en)

**Değişen dosyalar:** `app/(tabs)/groups/new.tsx`, `app/join/index.tsx`, `locales/tr.json`, `locales/en.json`

| Kontrol | Durum |
|---|---|
| `npx tsc --noEmit` | ✅ Temiz |
| 87/87 test geçti | ✅ |
| new.tsx: gradient hero | ✅ |
| new.tsx: karakter sayacı + ipucu | ✅ |
| new.tsx: bottom-sticky buton | ✅ KeyboardAvoidingView |
| join: aynı hero stili | ✅ |
| join: 3-adım akış korundu | ✅ |
| join: bottom-sticky butonlar | ✅ |

*Son güncelleme: 2026-06-02 — B85 eklendi (yeni grup + gruba katıl tasarım yenilemesi)*

---

### ✅ B86: İnline paneller → Modal bottom sheet (Yeni Grup + Gruba Katıl)

**Sorun:** FlatList içinde inline panel — klavye + zIndex + scroll çakışıyordu. Temelden yanlış pattern.

**Yapılan:**
- İnline paneller kaldırıldı, yerine **Modal tabanlı bottom sheet**:
  - `transparent` + `animationType="slide"`
  - `KeyboardAvoidingView` (iOS padding, Android height)
  - `TouchableWithoutFeedback` backdrop → basınca kapanır
- **Sheet stili:** `Colors.surface`, üst köşeler 24px oval, drag handle (4×40px gri çubuk), `Shadows.lg`
- **İçerik yapısı:** Başlık → TextInput → Vazgeç + Gradient buton
- `closeModal()`: tüm state'leri sıfırlar (groupName, joinCode, joinError)
- FlatList artık sadece grup kartlarını gösterir (ListFooterComponent yok)
- Input letter-spacing: `-0.2` (hafif sıkılaştırılmış)

**Değişen dosyalar:** `app/(tabs)/groups/index.tsx`

| Kontrol | Durum |
|---|---|
| Klavye sheet'i kaplamıyor | ✅ KeyboardAvoidingView |
| Backdrop'a basınca kapanır | ✅ TouchableWithoutFeedback |
| Grup listesi arkada görünür | ✅ transparent modal |
| Pro limiti korundu | ✅ reachedLimit |
| tsc temiz, 87 test | ✅ |

*Son güncelleme: 2026-06-02 — B86 eklendi (Modal bottom sheet)*

---

### ✅ B87: Aktivite araması tüm kullanıcılara açıldı

> Tarih: 2026-06-02

**Sorun:** Aktivite sayfasındaki metin arama Pro kapısına bağlıydı. Free kullanıcı arama input'u yerine kilitli satır görüyor ve tıklayınca paywall'a gidiyordu.

**Yapılan:**
- Aktivite arama çubuğundaki `isUserPro` koşulu kaldırıldı.
- Free ve Pro tüm kullanıcılar aynı arama input'unu görür.
- Arama debounce, temizle butonu, tr-TR normalize filtreleme ve boş sonuç mesajı aynen korundu.
- Artık aktivite araması paywall'a yönlendirme yapmaz.

**Değişen dosyalar:** `app/(tabs)/activity.tsx`

| Kontrol | Durum |
|---|---|
| Arama input'u tüm kullanıcılara açık | ✅ |
| Pro hook/import kullanılmıyor | ✅ |
| Paywall yönlendirmesi kaldırıldı | ✅ |
| Mevcut arama davranışı korundu | ✅ |

*Son güncelleme: 2026-06-02 — B87 eklendi (aktivite araması herkese açık)*

---

### ✅ B88: Paywall gradient header + 5s fiyat timeout

> Tarih: 2026-06-02

**Sorun:**
- Paywall fiyat bilgisi `getOfferings()` yanıtını sonsuza kadar bekleyebiliyordu.
- Paywall header düz yüzeyde kalıyor, uygulamanın modern fintech gradient hero diliyle tam tutarlı görünmüyordu.

**Yapılan:**
- `priceTimeout` state'i eklendi.
- Offerings yükleme akışına 5 saniyelik timeout eklendi; timeout olursa fiyat alanı warning rengiyle `paywall.priceError` gösterir.
- Offerings yüklenmeden önce fiyat alanı `ActivityIndicator` gösterir.
- CTA disabled koşulu `purchasing !== null || (!offeringsLoaded && !priceTimeout)` olarak güncellendi.
- Header `LinearGradient` ile `#4F46E5 → #7C3AED` hero yapısına taşındı.
- Elmas ikonu beyaz yarı saydam daire içine alındı; kapatma butonu gradient üzerinde beyaz tonla gösterildi.
- Feature rows, price card ve CTA yatay margin ile gradient dışındaki içerik genişliğiyle hizalandı.
- `paywall.priceError` tr/en i18n anahtarı eklendi.

**Değişen dosyalar:** `app/paywall.tsx`, `locales/tr.json`, `locales/en.json`

| Kontrol | Durum |
|---|---|
| Fiyat yüklenirken spinner | ✅ |
| 5 saniye sonra fiyat hata metni | ✅ |
| CTA bekleme sırasında disabled | ✅ |
| Gradient hero header | ✅ |
| i18n tr/en | ✅ |

*Son güncelleme: 2026-06-02 — B88 eklendi (paywall gradient header + fiyat timeout)*

---

### ✅ B89: Masraf önizleme split noktaları gradient avatar oldu

> Tarih: 2026-06-02

**Sorun:** Masraf kartı genişletilince görünen önizleme listesinde üyeler küçük kategori rengi noktayla temsil ediliyordu. Bu, üye kimliğini hızlı taramayı zorlaştırıyordu.

**Yapılan:**
- Split önizleme satırındaki nokta, üyenin baş harfini gösteren küçük `LinearGradient` avatara çevrildi.
- Avatar rengi `member.avatar_color` varsa onu, yoksa `Colors.primary` fallback'ini kullanır.
- `splitDetailDot` stili korunarak sadece ilgili JSX değiştirildi.
- `GroupMemberRow` tipine opsiyonel `avatar_color` alanı eklendi.

**Değişen dosyalar:** `app/(tabs)/groups/[id]/index.tsx`, `lib/supabase/types.ts`

| Kontrol | Durum |
|---|---|
| Split önizleme avatar gösterir | ✅ |
| `splitDetailDot` korunur | ✅ |
| `LinearGradient` mevcut import kullanılır | ✅ |
| Tip alanı eklendi | ✅ |

*Son güncelleme: 2026-06-02 — B89 eklendi (split önizleme avatarları)*

---

### ✅ B90: Split önizleme avatarları gerçek profil rengini kullanıyor

> Tarih: 2026-06-02

**Sorun:** Masraf kartı genişletilince split önizleme avatarları her üyede mavi fallback renge düşüyordu. `getGroupDetail` profil avatar renklerini `memberAvatarColors` map'i olarak çekiyor ama `members` satırlarına `avatar_color` alanını eklemiyordu.

**Yapılan:**
- `getGroupDetail` dönüşünde gerçek kullanıcı üyeleri `profile.avatar_color` ile zenginleştirildi.
- `members` içindeki her gerçek üye artık `avatar_color` alanını taşır.
- Hayalet üyelerde alan boş kalır ve UI fallback rengi kullanır.

**Değişen dosyalar:** `lib/supabase/queries.ts`

| Kontrol | Durum |
|---|---|
| Gerçek üyeler profil avatar rengini taşır | ✅ |
| Hayalet üyeler fallback kullanır | ✅ |
| Masraf kartı split avatarları gerçek renge döner | ✅ |

*Son güncelleme: 2026-06-02 — B90 eklendi (split avatar renkleri)*

---

### ✅ B91: Sadeleştirilmiş bakiye aksiyon ikonlarına etiket eklendi

> Tarih: 2026-06-02

**Sorun:** Sadeleştirilmiş bakiye satırında borçlu kullanıcının gördüğü iki küçük ikon butonun anlamı yeterince açık değildi.

**Yapılan:**
- Ödeme işaretleme ve IBAN isteme butonları dikey ikon + kısa etiket düzenine taşındı.
- Butonlara `accessibilityLabel` eklendi.
- Mevcut `actionIconBtn` stili korunarak yeni `actionIconBtnWrap`, `actionIconLabel`, `actionIconLabelBlue` stilleri eklendi.
- `settle.markPaid`, `settle.markPaidLabel`, `iban.request`, `iban.requestLabel` i18n anahtarları tr/en güncellendi.

**Değişen dosyalar:** `app/(tabs)/groups/[id]/index.tsx`, `locales/tr.json`, `locales/en.json`

| Kontrol | Durum |
|---|---|
| Ödeme butonu ikon + etiket gösterir | ✅ |
| IBAN butonu ikon + etiket gösterir | ✅ |
| `hitSlop` korundu | ✅ |
| `actionIconBtn` stili korundu | ✅ |
| i18n tr/en | ✅ |

*Son güncelleme: 2026-06-02 — B91 eklendi (bakiye aksiyon etiketleri)*

---

### ✅ B92: Gizlilik + Kullanım Koşulları ekranları

> Tarih: 2026-06-02

**Sorun:** Uygulama içinde App Store / Play Store hazırlığı için erişilebilir Gizlilik Politikası ve Kullanım Koşulları ekranları yoktu.

**Yapılan:**
- `app/legal/privacy.tsx` ve `app/legal/terms.tsx` statik legal ekranları eklendi.
- `app/legal/_layout.tsx` ile legal ekranlar için Stack header yapılandırıldı.
- `components/LegalScreen.tsx` ortak legal metin layout'u eklendi.
- Hesap ekranına "YASAL" section'ı, Gizlilik Politikası ve Kullanım Koşulları satırları eklendi.
- Root stack'e `legal` route grubu tanıtıldı.
- Gizlilik ve kullanım koşulları içerikleri tr/en i18n altında `legal.*` namespace'ine taşındı.

**Değişen dosyalar:** `app/legal/_layout.tsx`, `app/legal/privacy.tsx`, `app/legal/terms.tsx`, `components/LegalScreen.tsx`, `app/(tabs)/account.tsx`, `app/_layout.tsx`, `locales/tr.json`, `locales/en.json`

| Kontrol | Durum |
|---|---|
| Legal ekran route'ları eklendi | ✅ |
| Hesap ekranı linkleri eklendi | ✅ |
| Tüm metinler i18n'den geliyor | ✅ |
| Ortak LegalScreen kullanılıyor | ✅ |

*Son güncelleme: 2026-06-02 — B92 eklendi (legal ekranlar)*

---

### ✅ B93: i18n kullanılmayan groupDetail anahtarları temizlendi

> Tarih: 2026-06-02

**Sorun:** Locale dosyalarında karşılığı olmayan ve kodda kullanılmayan iki `groupDetail` anahtarı vardı: TR `expensesSoon`, EN `balancesEmpty`.

**Yapılan:**
- `rg "expensesSoon|balancesEmpty" -g "*.ts" -g "*.tsx"` ile kod kullanımının olmadığı doğrulandı.
- `locales/tr.json` içinden `groupDetail.expensesSoon` silindi.
- `locales/en.json` içinden `groupDetail.balancesEmpty` silindi.

**Değişen dosyalar:** `locales/tr.json`, `locales/en.json`

| Kontrol | Durum |
|---|---|
| Kodda kullanım yok | ✅ |
| TR-only anahtar silindi | ✅ |
| EN-only anahtar silindi | ✅ |

*Son güncelleme: 2026-06-02 — B93 eklendi (i18n anahtar temizliği)*

---

### ✅ B94: Kritik tıklanabilir elemanlara accessibility label eklendi

> Tarih: 2026-06-02

**Sorun:** Grup detay, hesap, üyeler, gruplar, paywall ve dashboard ekranlarındaki kritik tıklanabilir elemanların bir kısmında screen reader için açıklayıcı `accessibilityLabel` yoktu.

**Yapılan:**
- Belirlenen 6 dosyada kritik butonlara `accessibilityLabel` ve uygun yerlerde `accessibilityRole="button"` eklendi.
- Renk, dil ve para birimi seçimlerine `accessibilityRole="radio"` ve `accessibilityState.selected` eklendi.
- Tüm yeni label metinleri `t()` üzerinden okunacak şekilde TR/EN locale anahtarları eklendi.

**Değişen dosyalar:** `app/(tabs)/groups/[id]/index.tsx`, `app/(tabs)/account.tsx`, `app/(tabs)/groups/[id]/members.tsx`, `app/(tabs)/groups/index.tsx`, `app/paywall.tsx`, `app/(tabs)/dashboard.tsx`, `locales/tr.json`, `locales/en.json`

| Kontrol | Durum |
|---|---|
| Kritik buton label'ları eklendi | ✅ |
| Radio seçimlerde selected state eklendi | ✅ |
| Yeni metinler i18n'den geliyor | ✅ |

*Son güncelleme: 2026-06-02 — B94 eklendi (accessibility label'ları)*

---

### ✅ B95: Profil sayfasına Tips butonu eklendi

> Tarih: 2026-06-02

**Sorun:** Profil sayfasındaki görünen ad, avatar rengi, dil ve varsayılan para birimi tercihleri açıklama gerektiriyordu; özellikle para biriminin panel filtresi olduğu net değildi.

**Yapılan:**
- `app/(tabs)/account.tsx` header sağ alanına dashboard ile aynı `TipsButton` deseni eklendi.
- Profil sayfasına özel 4 ipucu `tips.account.*` altında TR/EN i18n'e eklendi.
- Varsayılan para biriminin para birimlerini çevirmediği veya toplamadığı, yalnızca panelde ilk filtreyi seçtiği belirtildi.

**Değişen dosyalar:** `app/(tabs)/account.tsx`, `locales/tr.json`, `locales/en.json`

| Kontrol | Durum |
|---|---|
| Profil header Tips butonu eklendi | ✅ |
| TR/EN tips metinleri eklendi | ✅ |
| Hardcoded görünen metin eklenmedi | ✅ |

*Son güncelleme: 2026-06-02 — B95 eklendi (profil tips butonu)*

---

### ✅ B96: Grup avatar header gradient tonu panel ile eşitlendi

> Tarih: 2026-06-02

**Sorun:** Paneldeki genel durum header'ı ile grup detay/düzenle ekranlarındaki avatar header gradient tonu farklı görünüyordu.

**Yapılan:**
- Grup detay header gradient'i `Colors.gradientStart` / `Colors.gradientEnd` sabitlerine bağlandı.
- Grup düzenle header gradient'i aynı tasarım sabitlerine bağlandı.
- Panel header ile grup avatar header'ları aynı mor tona getirildi.

**Değişen dosyalar:** `app/(tabs)/groups/[id]/index.tsx`, `app/(tabs)/groups/[id]/edit.tsx`

| Kontrol | Durum |
|---|---|
| Grup detay header tonu panel ile eşitlendi | ✅ |
| Grup düzenle header tonu panel ile eşitlendi | ✅ |
| Hardcoded ayrı gradient kaldırıldı | ✅ |

*Son güncelleme: 2026-06-02 — B96 eklendi (header gradient tonu)*

---

### ✅ B97: Grup header üst butonları kenarlara yaklaştırıldı

> Tarih: 2026-06-02

**Sorun:** Grup detay ve grup düzenle ekranlarındaki avatar header üst bar butonları, header yatay padding'i nedeniyle kenarlardan fazla içeride görünüyordu.

**Yapılan:**
- Grup detay header üst barına yatay negatif margin verildi.
- Grup düzenle header üst barı aynı ayarla hizalandı.
- Geri, düzenle ve tips butonlarının 44px dokunma alanı korunarak görsel konumları kenarlara yaklaştırıldı.

**Değişen dosyalar:** `app/(tabs)/groups/[id]/index.tsx`, `app/(tabs)/groups/[id]/edit.tsx`

| Kontrol | Durum |
|---|---|
| Grup detay üst bar butonları kenara yaklaştı | ✅ |
| Grup düzenle üst bar butonları kenara yaklaştı | ✅ |
| Dokunma alanı korundu | ✅ |

*Son güncelleme: 2026-06-02 — B97 eklendi (grup header üst buton hizası)*

### ✅ B98: IBAN Realtime broadcast sistemi kaldırıldı, WhatsApp yönlendirmesi eklendi

> Tarih: 2026-06-02

**Sorun:** Mevcut IBAN sistemi Supabase Realtime broadcast kullanıyordu. Bu yaklaşım karmaşık state yönetimi, 3 ayrı modal, ve gerçek zamanlı kanal aboneliği gerektiriyordu. Kullanıcılar arası IBAN paylaşımı yerine WhatsApp üzerinden mesaj gönderilmesi daha pratik.

**Yapılan:**
- **Kaldırılan state:** `ibanModalVisible`, `ibanTargetMember`, `ibanModalMode`, `ibanInputText`, `ibanReceivedText`, `ibanActiveRequestId`, `ibanChannelsRef`
- **Kaldırılan query/memo:** `iban_requests` useQuery, `pendingIbanReqs` useMemo
- **Kaldırılan useEffect:** Realtime IBAN broadcast dinleyicisi (supabase.channel, iban_shared)
- **Kaldırılan handler'lar:** `handleIbanRequest`, `handleIbanRequestConfirm`, `handleIbanEnter`, `handleIbanShare`
- **Kaldırılan JSX:** 3 adet IBAN modal (request/enter/received) + "Pending IBAN requests" creditor kartı
- **Kaldırılan stiller:** `ibanInput`, `ibanDisclaimer`, `ibanReceivedText`
- **Kaldırılan queries.ts fonksiyonları:** `requestIban()`, `getPendingIbanRequests()`, `fulfillIbanRequest()`
- **Kaldırılan types.ts:** `IbanRequestRow` import'u queries.ts'den kaldırıldı (interface hâlâ types.ts'de — ileride migration ile temizlenecek)
- **Yeni fonksiyon:** `generateIbanRequestMessage()` — queries.ts'e eklendi (WhatsApp mesaj şablonu)
- **Yeni handler:** `handleIbanWhatsApp()` — WhatsApp deep link açar, yoksa panoya kopyalar
- **Yeni bağımlılık:** `expo-clipboard` — panoya kopyalama fallback için
- **SimplifiedBalanceList:** `onIbanRequest` prop'u `onIbanWhatsApp` olarak değiştirildi; ikon `card-outline` → `logo-whatsapp` (#25D366)
- **i18n:** 12 eski anahtar silindi, 2 yeni anahtar eklendi (`iban.requestWhatsApp`, `iban.copiedFallback`)
- Kullanılmayan `supabase` client import'u kaldırıldı

**Değişen dosyalar:** `app/(tabs)/groups/[id]/index.tsx`, `lib/supabase/queries.ts`, `locales/tr.json`, `locales/en.json`, `package.json`

| Kontrol | Durum |
|---|---|
| tsc --noEmit temiz | ✅ |
| Eski IBAN state/query/useEffect/handler/modal tamamen silindi | ✅ |
| Yeni WhatsApp handler çalışıyor | ✅ |
| Clipboard fallback mevcut | ✅ |
| i18n anahtarları güncellendi (tr + en) | ✅ |
| expo-clipboard kuruldu | ✅ |
| iban_requests DB tablosuna dokunulmadı | ✅ |

*Son güncelleme: 2026-06-02 — B98 eklendi (IBAN Realtime → WhatsApp yönlendirme)*

### ✅ B99: Bakiye satırı hizalama — butonlar tutarın altına

> Tarih: 2026-06-02

**Sorun:** `SimplifiedBalanceList` bileşeninde borçlu satırlarında işlem butonları tutar kolonuyla yan yana yer alıyordu. Bu durum borçlu satırının sağ kolondaki tutar hizasını bozarak diğer satırlarla (Mehmet→Ali vb.) uyumsuz görünmesine neden oluyordu.

**Yapılan:**
- Tutar kolonunun her satırda sağ kolonda sabit ve hizalı kalması sağlandı.
- Borçlu satırına özel olan "Ödendi İşaretle" ve "IBAN İste" butonları, tutarın hemen altına yeni bir satır (`simplifiedActionRow`) olarak konumlandırıldı.
- Diğer satırların layout yapısı (`simplifiedTopRow`) korunarak hizalama düzeni düzeltildi.
- İlgili buton stilleri (`simplifiedActionRow`, `simplifiedActionBtn`, `simplifiedActionBtnText`, `simplifiedActionDivider`) eklendi.

**Değişen dosyalar:** `app/(tabs)/groups/[id]/index.tsx`

| Kontrol | Durum |
|---|---|
| tsc --noEmit temiz | ✅ |
| Diğer satırların layout'u korunuyor | ✅ |
| `simplifiedTopRow` stili değişmedi | ✅ |
| Butonlar tutarın altında ve hizalı | ✅ |

*Son güncelleme: 2026-06-02 — B99 eklendi (bakiye satırı hizalama — butonlar tutarın altına)*

---

### ✅ B100: Global Realtime invalidation panel, gruplar ve aktiviteye genişletildi

> Tarih: 2026-06-02

**Sorun:** Panel, gruplar listesi ve aktivite ekranı Supabase Realtime değişikliklerini anlık yansıtmıyordu. Global Realtime hook sadece `activity_log` dinliyordu; masraf, üye ve settlement değişiklikleri ilgili query cache'lerini tazelemiyordu.

**Yapılan:**
- `useRealtimeAllGroups` global hook'u `expenses`, `group_members`, `activity_log` ve `settlements` tablolarını dinleyecek şekilde genişletildi.
- Panelin gerçek query key'leri (`dashboard-hero`, `pro-analytics`, `all-user-expenses`, `expense-filter-options`) Realtime invalidation kapsamına alındı.
- Gruplar listesi ve dashboard ekranlarına memoize grup ID listesiyle `useRealtimeAllGroups` bağlandı.
- Aktivite ekranındaki grup ID listesi `useMemo` ile stabilize edildi.
- Gruplar, panel ve aktivite query'lerinde `staleTime` değerleri `0` yapıldı.
- WhatsApp IBAN refaktörü sonrası gereksiz kalan `iban_requests` Realtime listener'ı kaldırıldı.

**Değişen dosyalar:** `hooks/useRealtime.ts`, `hooks/useGroups.ts`, `app/(tabs)/groups/index.tsx`, `app/(tabs)/dashboard.tsx`, `app/(tabs)/activity.tsx`

| Kontrol | Durum |
|---|---|
| Global Realtime expenses/group_members/activity_log/settlements dinliyor | ✅ |
| Panel query'leri invalidate ediliyor | ✅ |
| Grup ID listeleri useMemo ile stabilize edildi | ✅ |
| `iban_requests` listener'ı kaldırıldı | ✅ |
| `npx tsc --noEmit` temiz | ✅ |

*Son güncelleme: 2026-06-02 — B100 eklendi (global realtime invalidation)*

---

### ✅ B101: Masraf tutarına dönünce sistem klavyesi kapanıyor

> Tarih: 2026-06-02

**Sorun:** Masraf ekleme ekranında açıklama/not gibi alanlarda sistem klavyesi açıkken tutar alanına dokunup numpad'e dönüldüğünde klavye ekranda kalabiliyordu.

**Yapılan:**
- Tutar alanı basma davranışı `handleAmountPress` fonksiyonuna taşındı.
- Tutar alanına basıldığında `Keyboard.dismiss()` çağrılarak sistem klavyesinin kapanması sağlandı.
- Mevcut numpad aç/kapat davranışı korundu.

**Değişen dosyalar:** `app/(tabs)/groups/[id]/add-expense.tsx`

| Kontrol | Durum |
|---|---|
| Tutar alanına basınca klavye kapanır | ✅ |
| Numpad toggle davranışı korundu | ✅ |
| `npx tsc --noEmit` temiz | ✅ |

*Son güncelleme: 2026-06-02 — B101 eklendi (masraf numpad klavye kapatma)*

---

### ✅ B102: Global Realtime channel isim çakışması düzeltildi

> Tarih: 2026-06-02

**Sorun:** `useRealtimeAllGroups` birden fazla tab ekranında çalışınca her instance aynı `global-changes` channel adını kullanıyordu. Supabase mevcut subscribe edilmiş channel'a tekrar `postgres_changes` callback eklemeye çalıştığı için `cannot add postgres_changes callbacks ... after subscribe()` hatası oluşuyordu.

**Yapılan:**
- Global Realtime channel adı her hook instance'ı için `useRef` ile benzersiz ve stabil hale getirildi.
- Re-render sırasında channel adı değişmeden kalıyor; farklı tab instance'ları birbirleriyle çakışmıyor.

**Değişen dosyalar:** `hooks/useRealtime.ts`

| Kontrol | Durum |
|---|---|
| Birden fazla global Realtime instance channel çakışması yaratmaz | ✅ |
| Channel adı render boyunca stabil | ✅ |
| `npx tsc --noEmit` temiz | ✅ |

*Son güncelleme: 2026-06-02 — B102 eklendi (global realtime channel çakışması)*

---

### ✅ B103: Masraf numpad detay paneli ve proje anayasası güncellendi

> Tarih: 2026-06-02

**Sorun:** Masraf ekleme ekranında numpad açılırken detay paneli açık kalınca ekran karışıyordu. Ayrıca AGENTS.md ve CLAUDE.md dosyalarında güncel IBAN, Realtime, Paywall, Auth ve B numarası kuralları tek kaynak olarak netleşmemişti.

**Yapılan:**
- Masraf tutar alanına basılıp numpad açılırken detay paneli otomatik kapatıldı.
- AGENTS.md içinde B numarasının her zaman BUGFIX-CILA.md'den bulunacağı, IBAN'ın WhatsApp sistemiyle çalıştığı ve global Realtime kuralları kayda alındı.
- CLAUDE.md içinde Auth, IBAN, Realtime, Paywall, Balance screen, migration ve accessibility bölümleri güncel proje kurallarına göre genişletildi.

**Değişen dosyalar:** `app/(tabs)/groups/[id]/add-expense.tsx`, `AGENTS.md`, `CLAUDE.md`, `BUGFIX-CILA.md`

| Kontrol | Durum |
|---|---|
| Numpad açılırken detay paneli kapanır | ✅ |
| AGENTS.md güncel B numarası, IBAN ve Realtime kurallarını içerir | ✅ |
| CLAUDE.md güncel Auth, IBAN, Realtime, Paywall, Balance ve accessibility kurallarını içerir | ✅ |
| `npx tsc --noEmit` temiz | ✅ |

*Son güncelleme: 2026-06-02 — B103 eklendi (masraf numpad detay paneli + anayasa güncellemeleri)*

---

## Faz 8 Store Hazırlık + Cila (16. Tur — B104-B112)

> Tarih: 2026-06-05
> Bağlam: app.json temizliği, route düzeltmeleri, privacy/terms sayfaları, sign-in redesign, onboarding renk tutarlılığı, dashboard invalidation

### ✅ B104: app.json — entitlements + expo-notifications plugin kaldırıldı

**Sorun:** iOS `entitlements.aps-environment: development` push notification yetkisi istiyordu (henüz kullanılmıyor). `expo-notifications` plugin'i app.json'da tanımlıydı ama push henüz aktif değil.

**Yapılan:**
- `ios.entitlements` bloğu tamamen kaldırıldı
- `plugins` dizisinden `expo-notifications` bloğu kaldırıldı
- JSON geçerli, virgül temizliği yapıldı

**Değişen dosyalar:** `app.json`

---

### ✅ B105: Route warnings — groups/[id] ve groups/new root layout'tan kaldırıldı

**Sorun:** `WARN [Layout children]: No route named "groups/[id]" exists in nested children` ve `No route named "groups/new"` — bu route'lar `(tabs)/groups/` altında olmasına rağmen root `_layout.tsx`'te direkt children olarak tanımlanmıştı.

**Yapılan:**
- `app/_layout.tsx` → `Stack.Screen name="groups/[id]"` ve `Stack.Screen name="groups/new"` kaldırıldı
- Route'lar zaten `(tabs)` → `groups/_layout.tsx` içinde doğru tanımlı

**Değişen dosyalar:** `app/_layout.tsx`

---

### ✅ B106: Gizlilik Politikası + Kullanım Koşulları HTML sayfaları + vercel.json

**Sorun:** App Store ve Google Play başvurusu için privacy policy ve terms of service URL'leri zorunlu. Projede bu sayfalar yoktu.

**Yapılan:**
- `privacy.html` ve `terms.html` — proje kökünde statik HTML sayfaları
- Tasarım: `#F7F6FF` arka plan, `#4F46E5` başlıklar, `#1E1B4B` metin, system-ui font
- Responsive, mobile-friendly, Groopay marka başlığı
- `vercel.json` — `/privacy` → `/privacy.html`, `/terms` → `/terms.html` rewrite kuralları
- URL'ler: `https://groopay.vercel.app/privacy` ve `https://groopay.vercel.app/terms`
- `app.json`'a `privacyPolicyUrl` eklendi

**Değişen dosyalar:** `privacy.html` (yeni), `terms.html` (yeni), `vercel.json` (yeni), `app.json`

---

### ✅ B107: account.tsx — privacy/terms linkleri Linking.openURL ile bağlandı

**Sorun:** Hesap sayfasında Gizlilik Politikası ve Kullanım Koşulları butonları `router.push('/legal/...')` ile dahili sayfalara yönleniyordu. Vercel'deki HTML sayfalarına yönlenmeliydi.

**Yapılan:**
- `Linking` import'u eklendi
- Gizlilik Politikası → `Linking.openURL('https://groopay.vercel.app/privacy')`
- Kullanım Koşulları → `Linking.openURL('https://groopay.vercel.app/terms')`

**Değişen dosyalar:** `app/(tabs)/account.tsx`

---

### ✅ B108: Sign-in ekranı yenileme

**Sorun:** Mevcut sign-in ekranı düz beyaz arka plan, cüzdan ikonu, sade butonlar — yavan tasarım.

**Yapılan:**
- Tam ekran gradient: `#4F46E5 → #7C3AED`
- Hero: `icon.png` Image (yuvarlak container, gölgeli), "Groopay" 32px bold beyaz, tagline %80 opacity
- Alt card: beyaz, `borderTopRadius: 24`
- Google butonu: beyaz + hafif gölge + Google "G" ikonu
- Apple butonu: siyah + Apple ikonu beyaz
- Buton: height 54px, borderRadius 14px
- Yasal metin: tıklanabilir Kullanım Koşulları + Gizlilik Politikası linkleri
- `__DEV__` guard korundu
- i18n: `googleSignIn`/`appleSignIn` → "devam et" formatı, yeni `legalDisclaimer`/`termsLink`/`privacyLink` anahtarları

**Değişen dosyalar:** `app/(auth)/sign-in.tsx`, `locales/tr.json`, `locales/en.json`

---

### ✅ B109: Onboarding ekranları renk tutarsızlığı düzeltildi

**Sorun:** Her onboarding slide'ı farklı gradient kullanıyordu. StatusBar ve safe area renkleri farklıydı. Alt buton alanı gradient'ten kopuk beyaz görünüyordu.

**Yapılan:**
- Tüm onboarding tek gradient: `#4F46E5 → #7C3AED` (slide başına farklı renk yok)
- `StatusBar style="light"` eklendi
- Slide'lar `LinearGradient` wrapper yerine şeffaf arka plan
- Alt buton gradient ile aynı zeminde, ayrı beyaz alan yok
- `SLIDE_GRADIENTS` sabiti kaldırıldı

**Değişen dosyalar:** `app/(onboarding)/intro.tsx`

---

### ✅ B110: Dashboard masraf sonrası otomatik güncellenmeme sorunu

**Sorun:** Masraf eklendikten/düzenlendikten/silindikten sonra Panel (dashboard) sekmesi otomatik güncellenmiyordu. Sayfayı manuel yenilemek gerekiyordu.

**Kök neden:** `useAddExpense`, `useUpdateExpense`, `useDeleteExpense` mutation'ları sadece `['expenses']`, `['groups']`, `['activity']` key'lerini invalidate ediyordu. Dashboard `['dashboard-hero']`, `['pro-analytics']`, `['all-user-expenses']`, `['expense-filter-options']` key'lerini kullanıyordu ama bunlar hiç invalidate edilmiyordu.

**Yapılan:**
- Üç mutation'ın `onSuccess` callback'ine eklendi:
  - `['balances', groupId]` (veya `['balances']`)
  - `['dashboard']`
  - `['dashboard-hero']`
  - `['pro-analytics']`
  - `['all-user-expenses']`
  - `['expense-filter-options']`
- `staleTime` zaten 0 olduğu için ek değişiklik gerekmedi

**Değişen dosyalar:** `hooks/useExpenses.ts`

---

### ✅ B111: Sign-in legalDisclaimer interpolasyon düzeltildi + app icon Image ile değiştirildi

**Sorun 1:** `legalDisclaimer` metni `{terms}` ve `{privacy}` placeholder'larını literal olarak gösteriyordu. i18next `{{}}` çift süslü parantez bekler, `{}` tek parantez çalışmaz.

**Sorun 2:** "G" harfi logo yerine gerçek app icon kullanılmalıydı.

**Yapılan:**
- `legalDisclaimer` interpolation kaldırıldı, metin direkt yazıldı:
  - TR: "Devam ederek Kullanım Koşulları ve Gizlilik Politikası'nı kabul etmiş olursunuz"
  - EN: "By continuing, you agree to our Terms of Service and Privacy Policy"
- Logo: `<Text>G</Text>` → `<Image source={require('../../icon.png')} />`
- Kullanılmayan `Shadows` import'u temizlendi

**Değişen dosyalar:** `app/(auth)/sign-in.tsx`, `locales/tr.json`, `locales/en.json`

---

### ✅ B112: App icon güncellendi

**Sorun:** Eski `assets/images/icon.png` (393KB, Mayıs) ile yeni `icon.png` (72KB, Haziran — Groopay ikonu) farklıydı. iPhone ana ekranda eski ikon görünüyordu.

**Yapılan:**
- Yeni `icon.png` → `assets/images/icon.png` üzerine kopyalandı
- `app.json`'da `"icon": "./icon.png"` zaten doğru

**Değişen dosyalar:** `assets/images/icon.png`, `icon.png`

| Kontrol | Durum |
|---|---|
| `npx tsc --noEmit` | ✅ Temiz (sadece önceden var olan `expo-notifications` import hatası) |
| app.json entitlements | ✅ Kaldırıldı |
| app.json expo-notifications plugin | ✅ Kaldırıldı |
| Route warnings | ✅ Sıfır |
| privacy.html + terms.html | ✅ Vercel'de canlı |
| account.tsx linkleri | ✅ Linking.openURL |
| Sign-in tasarım | ✅ Gradient + hero + card |
| Onboarding renk | ✅ Tek gradient |
| Dashboard invalidation | ✅ Tüm key'ler |
| App icon | ✅ Yeni ikon |

*Son güncelleme: 2026-06-05 — B112 eklendi (Faz 8 store hazırlık + cila)*

---

### ✅ B113: Supabase auth ve DB client ayrımı

**Sorun:** `accessToken` callback ile oluşturulan Supabase client üzerinden `signInWithOAuth` çağrısı yapılamıyor ve `"accessing supabase.auth.signInWithOAuth is not possible"` hatası oluşuyordu.

**Yapılan:**
- OAuth, kullanıcı doğrulama ve anonim giriş için ayrı `supabaseAuth` client oluşturuldu
- RLS korumalı DB sorguları ve RPC çağrıları mevcut `supabase` access-token client üzerinde bırakıldı
- OAuth callback ve cold-start token doğrulaması `supabaseAuth.auth.getUser(token)` kullanacak şekilde güncellendi
- Anonim giriş ve PKCE fallback sonrasında access token DB client'a aktarılıp AsyncStorage'a kaydedildi
- Sign-out akışındaki token holder ve AsyncStorage temizliği korundu

**Değişen dosyalar:** `lib/supabase/client.ts`, `lib/auth/AuthContext.tsx`, `app/auth/callback.tsx`

**Test:** 87/87 finans testi geçti; auth/DB kullanım ayrımı `rg` ile doğrulandı. `npx tsc --noEmit` yalnızca önceden mevcut `expo-notifications` eksik modül hatasını veriyor.

*Son güncelleme: 2026-06-06 — B113 eklendi*

---

### ✅ B114: Production build blocker'ları giderildi

**Sorun:**
- Provisioning conflict nedeniyle kaldırılan `expo-notifications` paketi `lib/notifications/index.ts` tarafından import edilmeye devam ediyor ve TypeScript kontrolünü bozuyordu.
- EAS production environment içinde Supabase ve RevenueCat için gereken `EXPO_PUBLIC_` değişkenleri tanımlı değildi.

**Yapılan:**
- `expo-notifications`, React Native ve Supabase import'ları bildirim modülünden kaldırıldı.
- `registerPushToken`, `setupNotificationHandler`, `sendPushToUser` ve `remindDebtor` mevcut imzaları korunarak no-op stub'lara çevrildi.
- Stub'lar development modunda `push disabled` log'u bırakacak şekilde düzenlendi.
- Push altyapısının launch sonrasında yeniden etkinleştirilmesi için TODO eklendi.
- `send-push` Edge Function değiştirilmedi.
- `.env` içindeki dolu `EXPO_PUBLIC_` değişkenleri EAS production environment'a plaintext olarak eklendi: Supabase URL, Supabase anon key ve RevenueCat Apple key.
- `.env` ve API key değerleri repoya eklenmedi.

**Değişen dosyalar:** `lib/notifications/index.ts`, `BUGFIX-CILA.md`

**Nasıl test edilir:**
1. `npx tsc --noEmit`
2. `npm test`
3. `eas env:list --environment production`
4. `package.json` ve `app.json` içinde `expo-notifications` dependency/plugin olmadığını doğrula.

| Kontrol | Durum |
|---|---|
| `npx tsc --noEmit` temiz | ✅ |
| `npm test` 87/87 geçti | ✅ |
| Bildirim export imzaları korundu | ✅ |
| `expo-notifications` paketi geri eklenmedi | ✅ |
| `send-push` Edge Function değişmedi | ✅ |
| EAS production Supabase değişkenleri mevcut | ✅ |
| EAS production RevenueCat Apple key mevcut | ✅ |
| `.env` ve API key'ler commit dışında | ✅ |

*Son güncelleme: 2026-06-06 — B114 eklendi*

---

### ✅ B115: Production misafir girişi ve Pro hesap yükseltme

**Sorun:**
- Çalışan Supabase anonim auth altyapısı yalnızca `__DEV__` test butonunun arkasındaydı; production kullanıcısı hesap oluşturmadan başlayamıyordu.
- Misafir kullanıcı Pro satın almayı başlatırsa aboneliğin kalıcı bir OAuth hesabına bağlanmasını ve anonim verilerin korunmasını garanti eden bir kapı yoktu.
- Mevcut `linkIdentity` dalı provider URL'sini açmadan başarı kabul edebiliyor ve hata halinde yeni OAuth kullanıcısına düşebiliyordu.

**Yapılan:**
- Giriş ekranına production'da görünen, düşük vurgulu `Misafir olarak devam et` butonu ve açıklaması eklendi.
- Mevcut `signIn()` / `signInAnonymously()` akışı aynen kullanıldı; yeni Supabase client veya anonim akış oluşturulmadı.
- AuthContext doğrulanmış Supabase user bilgisinden `isAnonymous` state'i sunacak şekilde güncellendi.
- Anonim → Google/Apple yükseltmesi `linkIdentity` provider URL'sini açacak ve callback tokenını doğrulayacak şekilde tamamlandı.
- Yükseltme sonrasında dönen user ID anonim user ID ile karşılaştırılıyor; ID değişirse işlem hata veriyor.
- Cold start sonrasında identity linking için saklanan anonim access/refresh tokenlarla mevcut auth client session'ı kontrollü olarak hazırlanıyor.
- `linkIdentity` başarısız olduğunda yeni OAuth hesabına fallback kaldırıldı; anonim veri korunuyor ve satın alma başlatılmıyor.
- Paywall satın alma CTA'sı misafir kullanıcıya Google/Apple seçimi gösteriyor; aynı kullanıcı üzerinde yükseltme başarılı olursa mevcut RevenueCat satın alma akışına devam ediyor.
- Grup oluşturma, gruba katılma, masraf, bölüşme, bakiye ve davet akışlarına misafir kısıtı eklenmedi.
- Auth kararları `CLAUDE.md` ve `SESSION-OZET.md` içinde güncellendi.

**Değişen dosyalar:** `app/(auth)/sign-in.tsx`, `app/paywall.tsx`, `lib/auth/AuthContext.tsx`, `lib/auth/types.ts`, `locales/tr.json`, `locales/en.json`, `CLAUDE.md`, `SESSION-OZET.md`, `BUGFIX-CILA.md`

**Nasıl test edilir:**
1. Production/dev build giriş ekranında `Misafir olarak devam et` butonuna bas ve onboarding'i tamamla.
2. Misafir olarak grup oluştur, masraf ekle ve davet koduyla başka gruba katıl.
3. Misafir hesabın user ID'sini ve oluşturduğu grup/masraf kayıtlarını not et.
4. Paywall'da `Pro'ya Geç` butonuna bas, Google veya Apple seç ve OAuth'u tamamla.
5. Yükseltme sonrası user ID'nin değişmediğini ve önceki grup/masrafların görünmeye devam ettiğini doğrula.
6. Başka kullanıcıya bağlı provider ile denendiğinde satın almanın başlamadığını ve anonim verinin silinmediğini doğrula.

| Kontrol | Durum |
|---|---|
| Misafir butonu production'da görünür | ✅ |
| Mevcut anonim auth akışı yeniden kullanıldı | ✅ |
| İki-client Supabase mimarisi korundu | ✅ |
| Temel özelliklere misafir kısıtı eklenmedi | ✅ |
| Pro satın alma öncesi OAuth yükseltme zorunlu | ✅ |
| `linkIdentity` sonrası aynı user ID doğrulanıyor | ✅ |
| Link hatasında yeni kullanıcı fallback'i yok | ✅ |
| TR/EN i18n anahtarları eklendi | ✅ |
| `npx tsc --noEmit` temiz | ✅ |
| `npm test` 87/87 geçti | ✅ |

*Son güncelleme: 2026-06-06 — B115 eklendi*

---

### ✅ B116: iOS native Sign in with Apple

**Sorun:**
- Apple girişi iOS'ta Supabase web OAuth ile tarayıcı açıyordu; native Apple modalı kullanılmıyordu.
- Misafir hesabın native Apple kimliğiyle yükseltilmesi sırasında yeni kullanıcı oluşmaması ve mevcut grup/masraf verilerinin aynı user ID altında korunması gerekiyordu.

**Yapılan:**
- Expo SDK 54 uyumlu `expo-apple-authentication` ve nonce üretimi/hashleme için `expo-crypto` eklendi.
- `app.json` içinde `ios.usesAppleSignIn: true` ve `expo-apple-authentication` config plugin'i tanımlandı; EAS prebuild'de `com.apple.developer.applesignin` entitlement'ı üretilecek.
- iOS Apple girişi `AppleAuthentication.signInAsync()` ile native modal kullanacak şekilde güncellendi.
- Kriptografik ham nonce üretildi, SHA-256 özeti Apple'a gönderildi ve ham nonce Supabase `signInWithIdToken` / `linkIdentity` doğrulamasına verildi.
- Normal iOS Apple girişinde `supabaseAuth.auth.signInWithIdToken()` kullanıldı; dönen access token mevcut iki-client mimarisindeki DB client'a ve AsyncStorage'a aktarıldı.
- Misafir iOS Apple yükseltmesinde kurulu Supabase SDK'nın native ID-token destekli `linkIdentity()` yolu kullanıldı. Dönüşte user ID anonim user ID ile karşılaştırılıyor; eşleşmezse eski anonim session geri yükleniyor, satın alma başlamıyor ve mevcut veri silinmiyor.
- Android Apple girişi mevcut Supabase web OAuth akışında bırakıldı.
- Apple native akışındaki kullanıcıya gösterilen hata metinleri TR/EN i18n'e eklendi.
- Auth mimarisi `CLAUDE.md` ve `SESSION-OZET.md` içinde güncellendi.
- Bu native modül ve Apple entitlement değişikliği yeni iOS dev/production build gerektirir. Önceki capability sync sorunu nedeniyle build komutunda `EXPO_NO_CAPABILITY_SYNC=1` gerekebilir; build Fatih tarafından alınacak.

**Değişen dosyalar:** `lib/auth/AuthContext.tsx`, `app.json`, `package.json`, `package-lock.json`, `locales/tr.json`, `locales/en.json`, `CLAUDE.md`, `SESSION-OZET.md`, `BUGFIX-CILA.md`

**Nasıl test edilir:**
1. Apple Sign In capability açık `com.groopay.app` için yeni iOS dev/production build al.
2. iOS gerçek cihazda Apple butonuna bas; tarayıcı yerine native Apple modalının açıldığını doğrula.
3. Normal kullanıcı girişinden sonra uygulamayı kapat/aç; profil ve RLS korumalı verilerin aynı kullanıcıyla geldiğini doğrula.
4. Misafir olarak giriş yap, grup ve masraf oluştur, anonim user ID'yi kaydet.
5. Paywall'da Pro'ya bas, Apple'ı seç ve native modalı tamamla.
6. Yükseltme sonrasında user ID'nin değişmediğini, misafir grubunun/masraflarının görünmeye devam ettiğini ve ardından satın alma akışının başladığını doğrula.
7. Başka kullanıcıya bağlı Apple kimliğiyle denendiğinde yükseltmenin hata verdiğini, satın almanın başlamadığını ve anonim verinin korunduğunu doğrula.
8. Android'de Apple butonunun mevcut web OAuth tarayıcı akışını açmaya devam ettiğini doğrula.

| Kontrol | Durum |
|---|---|
| iOS Apple girişi native `signInAsync` kullanıyor | ✅ |
| Nonce kriptografik üretilip SHA-256 hashleniyor | ✅ |
| Normal giriş `signInWithIdToken` kullanıyor | ✅ |
| Misafir yükseltme native ID token ile `linkIdentity` kullanıyor | ✅ |
| Link sonrası aynı user ID doğrulanıyor | ✅ |
| Hata halinde anonim token/veri silinmiyor | ✅ |
| Android web OAuth akışı korunuyor | ✅ |
| İki-client Supabase mimarisi korunuyor | ✅ |
| Apple entitlement config'i etkin | ✅ |
| `npx tsc --noEmit` temiz | ✅ |
| `npm test` 87/87 geçti | ✅ |

*Son güncelleme: 2026-06-07 — B116 eklendi*

---

### ✅ B117: Atomik ve eksiksiz hesap silme

**Sorun:**
- `delete-account` Edge Function solo grupları loop içinde doğrudan siliyor, silme hatalarını kontrol etmiyor ve FK temizliğini transaction dışında yapıyordu.
- İlişkili masraf/üye kayıtları olan demo veya solo grup silinemediğinde bazı gruplar siliniyor, profil ve `auth.users` kaydı kalıyordu.
- Supabase Dashboard'dan kullanıcı silme de `profiles` tablosuna bağlı cascade olmayan FK'lar nedeniyle hata veriyordu.

**Yapılan:**
- Uygulanmış `0016_delete_user_data.sql` migration'ı repoya eklendi.
- `delete_user_data` SECURITY DEFINER RPC'si `auth.uid() = target_user_id` kontrolüyle solo ve demo kurucu gruplarını FK sırasına göre tek transaction içinde temizliyor.
- Başka aktif gerçek üyeli normal grupların kurucusu için mevcut `FOUNDER_GROUPS_EXIST` engeli korundu; demo gruplar bu engele dahil edilmedi.
- Ortak gruplardaki finans geçmişi silinmedi; kullanıcının üyeliği `user_id = NULL` ve `is_active = false` yapılarak anonimleştirildi.
- Edge Function iki Supabase client kullanacak şekilde yenilendi: RPC kullanıcı Authorization header'ı + anon key ile, `auth.admin.deleteUser()` yalnızca service role ile çağrılıyor.
- RPC `FOUNDER_GROUPS_EXIST` hatası 409, `UNAUTHORIZED` hatası 403 olarak dönüyor. Temizlik ve auth silme hataları ayrı hata kodlarıyla raporlanıyor.
- Client'ın mevcut 3 adımlı silme akışı korundu; founder 409 mesajı ve auth kaydı silme retry durumu hata kodlarına göre i18n mesajlarıyla gösteriliyor.
- `GUVENLIK-ANALIZI.md` içindeki YN-8 kapatıldı.

**Değişen dosyalar:** `supabase/migrations/0016_delete_user_data.sql`, `supabase/functions/delete-account/index.ts`, `app/(tabs)/account.tsx`, `locales/tr.json`, `locales/en.json`, `GUVENLIK-ANALIZI.md`, `CLAUDE.md`, `SESSION-OZET.md`, `BUGFIX-CILA.md`

**Nasıl test edilir:**
1. `supabase functions deploy delete-account` ile Edge Function'ı yeniden deploy et.
2. Başka gerçek üyeli normal grubun kurucusu olan hesapta silmeyi dene; 409 engeli ve grup adları görünmeli.
3. Sadece solo grup ve demo grubu olan hesapta silmeyi tamamla; tüm bu gruplar, profil ve auth kullanıcısı silinmeli.
4. Başkasının grubuna üye hesapta silmeyi tamamla; ortak grup ve finans geçmişi kalmalı, üyelik hayalet/pasif satıra dönüşmeli.
5. Aynı kullanıcıyı Supabase Authentication ve `profiles` tablosunda arayarak hiçbir hesap kaydı kalmadığını doğrula.

| Kontrol | Durum |
|---|---|
| RPC kullanıcı JWT'siyle çağrılıyor | ✅ |
| Service role yalnızca auth user silmede kullanılıyor | ✅ |
| `auth.uid()` hedef kullanıcı kontrolü mevcut | ✅ |
| Solo/demo grup temizliği atomik | ✅ |
| FK silme sırası eksiksiz | ✅ |
| B37 founder engeli korunuyor | ✅ |
| Ortak grup finans geçmişi korunuyor | ✅ |
| YN-8 kapatıldı | ✅ |
| `npx tsc --noEmit` temiz | ✅ |
| `npm test` 87/87 geçti | ✅ |

*Son güncelleme: 2026-06-07 — B117 eklendi*

---

### ✅ B118: Cold start ve foreground auth token refresh

**Sorun:**
- `supabaseAuth` istemcisinde React Native `setSession()` / `getSession()` takılma sorununu önlemek için `autoRefreshToken: false` kullanılıyordu.
- Access token yaklaşık bir saat sonra sona erdiğinde cold start akışı refresh token'ı kullanmadan saklanan tokenları siliyor, foreground dönüşünde ise hiç token kontrolü yapmıyordu.
- Kullanıcı uygulamayı arka plandan açtığında veya uzun süre sonra geri döndüğünde otomatik çıkış yapmış gibi görünüyordu.

**Yapılan:**
- İki-client Supabase mimarisi ve `autoRefreshToken: false` kararı korundu.
- Access token expiry değeri AsyncStorage'a kaydedildi; token sona ermeden 15 dakika önce manuel refresh gerekli kabul ediliyor.
- Cold start akışına `supabaseAuth.auth.refreshSession({ refresh_token })` eklendi.
- `AppState` listener ile `background` / `inactive` durumundan `active` durumuna dönüşte token kontrolü ve gerektiğinde manuel refresh eklendi.
- Başarılı refresh sonrası yeni access/refresh token ve expiry AsyncStorage'a yazılıyor; `setSupabaseAccessToken()` ile DB client anında yeni JWT'yi kullanıyor.
- Eşzamanlı AppState event'leri promise kilidi ve 5 saniyelik debounce ile tek refresh isteğine indirildi.
- Refresh isteğine 10 saniyelik timeout eklendi. Ağ/servis hatasında tokenlar temizlenmiyor; son doğrulanmış auth snapshot'ı cold start için korunuyor.
- Refresh token kesin olarak geçersizse auth state temizleniyor, giriş ekranına yönlendiriliyor ve i18n "Oturum sona erdi" mesajı gösteriliyor.
- Google/Apple OAuth, native Apple identity linking ve anonim giriş akışlarının davranışı değiştirilmedi; yalnızca oluşan session'ların expiry bilgisi de saklanıyor.

**Değişen dosyalar:** `lib/auth/AuthContext.tsx`, `lib/supabase/client.ts`, `locales/tr.json`, `locales/en.json`, `CLAUDE.md`, `SESSION-OZET.md`, `BUGFIX-CILA.md`

**Test:**
1. `npx tsc --noEmit`
2. `npm test`
3. Giriş yaptıktan sonra uygulamayı 45 dakikadan uzun süre arka planda bırak; geri dönüşte kullanıcı ve RLS korumalı veriler korunmalı.
4. Uygulamayı sona ermeye yakın token ile cold start et; `[auth] Access token refreshed` log'u görülmeli.
5. Ağı kapatıp uygulamayı foreground'a getir; kullanıcı çıkış yapmamalı.
6. Geçersiz refresh token ile aç; giriş ekranı ve yerelleştirilmiş oturum sonu mesajı görülmeli.

*Son güncelleme: 2026-06-07 — B118 eklendi*

---

### ✅ B119: Web sitesi ve yasal sayfalara İngilizce dil seçeneği

**Sorun:**
- `https://groopay.vercel.app/`, gizlilik politikası ve kullanım koşulları yalnızca Türkçe sunuluyordu.
- App Store Connect, inceleme için İngilizce bir privacy policy URL'si istiyordu.
- Web ve uygulama içi legal metinlerde birden fazla eski iletişim e-posta adresi kullanılıyordu.

**Yapılan:**
- Ana sayfa, gizlilik politikası ve kullanım koşullarına erişilebilir `TR / EN` dil seçici eklendi.
- İngilizce ana sayfa ve tam İngilizce legal metinler oluşturuldu.
- Vercel rewrite'larına İngilizce rotalar eklendi:
  - `https://groopay.vercel.app/en`
  - `https://groopay.vercel.app/en/privacy`
  - `https://groopay.vercel.app/en/terms`
- App Store Connect privacy policy alanında kullanılacak URL `https://groopay.vercel.app/en/privacy` olarak belirlendi.
- Türkçe ve İngilizce web sayfaları ile uygulama içi legal metinlerde iletişim adresi `behavest@proton.me` olarak tekilleştirildi.
- `eas.json` içindeki Apple Developer giriş hesabı bir iletişim adresi olmadığı için değiştirilmedi.

**Değişen dosyalar:** `public/index.html`, `public/privacy.html`, `public/terms.html`, `public/en/index.html`, `public/en/privacy.html`, `public/en/terms.html`, `vercel.json`, `privacy.html`, `terms.html`, `locales/tr.json`, `locales/en.json`, `SESSION-OZET.md`, `BUGFIX-CILA.md`

**Test:**
1. `/`, `/privacy`, `/terms` sayfalarında `TR` seçili olmalı ve `EN` doğru İngilizce sayfaya gitmeli.
2. `/en`, `/en/privacy`, `/en/terms` sayfalarında `EN` seçili olmalı ve `TR` doğru Türkçe sayfaya gitmeli.
3. Altı Vercel rotasının hedef HTML dosyaları mevcut olmalı.
4. Repo genelinde eski public iletişim adresi kalmamalı.
5. `npx tsc --noEmit` ve `npm test` temiz geçmeli.

*Son güncelleme: 2026-06-07 — B119 eklendi*
