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

*Son güncelleme: 2026-05-31 — B36 eklendi (tab bar + animasyonlar + header düzeltmeleri)*
