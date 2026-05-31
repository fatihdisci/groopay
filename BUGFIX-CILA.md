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

*Son güncelleme: 2026-05-31 — B18 eklendi*
