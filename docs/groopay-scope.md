# Groopay — Kapsam & Karar Belgesi

> Küçük gruplar için masraf bölüşme, borç takibi ve hatırlatma uygulaması.  
> Bu belge, projenin yaşayan karar kaydıdır. Yeni kararlar buraya eklenir.

---

## Uygulama Kimliği

| Alan | Karar |
|---|---|
| **İsim** | Groopay |
| **Kategori** | Masraf bölüşme / borç takibi |
| **Platform** | iOS + Android |
| **Yayın Hedefi** | App Store + Google Play |

---

## Hedef Kitle

- **Birincil:** Ev/aile — sürekli birlikte yaşayan küçük gruplar (kira, fatura, market)
- **Birincil:** Arkadaş grubu / etkinlik — tatil, yemek, organizasyon masrafları
- **Dışarıda bırakılan:** Büyük topluluk / sınıf / aidat modeli (bu sürümde yok)

---

## Temel Prensipler (Değişmez Kararlar)

- ✅ **Sadece takip.** Uygulama içinde gerçek para hareketi yok. Para dışarıda el değiştirir.
- ✅ **Hibrit üye modeli.** Herkes uygulamayı indirmek zorunda değil.
- ✅ **Orijinal para biriminde saklama.** Masraf hangi para biriminde girildiyse öyle saklanır. Çevrim sadece görüntüleme içindir, kaydedilmez.

---

## Üye Modeli

| Üye Tipi | Nasıl Eklenir | Bildirim Alır mı |
|---|---|---|
| **Hayalet üye** | Kurucu adını/bilgilerini girer | ❌ (WhatsApp özeti ile manuel) |
| **Gerçek kullanıcı** | Davet linki / telefon ile katılır | ✅ Push bildirim |

---

## Kimlik, Gizlilik & IBAN

- **Giriş:** Google + Apple ile giriş. (Apple, üçüncü-parti giriş sunulunca "Apple ile Giriş"i zorunlu kıldığı için ikisi birlikte.) Şifre saklanmaz.
- **IBAN SAKLANMAZ.** Uygulama IBAN'ı **hiçbir koşulda** veritabanında tutmaz (opsiyonel kayıt bile yok) → KVKK riski sıfır. Bunun yerine **"IBAN iste"** akışı: borçlu, alacaklıdan IBAN ister; alacaklıya bildirim gider, IBAN'ını **o an** girip paylaşır; ödeme uygulama dışında yapılır, IBAN iletildikten sonra saklanmaz.
- **İsim:** Gerçek üye grupta **hesap adıyla** görünür (gruba özel takma ad yok — sade).
- **Hayalet → gerçek:** Hayalet üye sonradan gerçek hesapla katılınca o kimliğe **bağlanır (claim)**, tüm geçmişi taşınır. *(Veri modeli: üye satırında nullable `user_id`.)*

---

## MVP Özellikleri

### Grup Yönetimi
- [ ] Grup oluşturma (isim, opsiyonel fotoğraf)
- [ ] Hayalet üye ekleme (kurucu girer)
- [ ] Gerçek kullanıcı davet etme — **paylaşılabilir linkle anında katılım**
- [ ] Üye rolü: kurucu vs. normal üye
- [ ] Üye çıkışı/çıkarma → **"eski üye"** (yeni masrafa eklenmez, geçmiş/bakiye kalır); **tam silme yalnız bakiye sıfırken**; açık bakiyede çıkarken uyarı

### Masraf İşlemleri
- [ ] Masraf ekleme (tutar, açıklama, tarih, ödeyenin adı)
- [ ] **Eşit bölüşme** (herkese eşit pay)
- [ ] **Özel bölüşme** (kişiye özel tutar / oran / pay)
- [ ] **Alt-küme bölüşme** (masrafa dahil üyeleri seç — herkese bölmek zorunda değil)
- [ ] Masraf kategorisi seçimi (aşağıya bak)
- [ ] Masraf düzenleme / silme

### Kategoriler
- [ ] Yemek & Market
- [ ] Ulaşım
- [ ] Kira & Fatura
- [ ] Eğlence
- [ ] Seyahat
- [ ] Diğer (serbest giriş)

### Çoklu Para Birimi
- [ ] Masrafa para birimi etiketi — masraf orijinal para biriminde saklanır (TRY'ye çevrilmez)
- [ ] Canlı kur API entegrasyonu (Frankfurter, ücretsiz) — sadece görüntüleme amaçlı
- [ ] "TRY karşılığını göster" toggle'ı → o an canlı kur çekilir → "≈ X TRY (bugünkü kur, bilgi amaçlı)" gösterilir; bu değer HİÇBİR yere kaydedilmez
- [ ] Varsayılan görüntüleme para birimi seçimi (grup bazında) — eskiden "ana para birimi" denirdi
- [ ] Bakiyeler orijinal para biriminde gösterilir; farklı para birimleri ayrı satırlarda (örn. "Ali sana 50 EUR + 200 TRY borçlu")

### Borç Takibi & Netleştirme
- [ ] Grup bazında "kim kime ne kadar borçlu" ekranı
- [ ] Sadeleştirilmiş netleştirme ("en az işlemle kim kime öder")
- [ ] "Ödendi" akışı: borçlu "ödedim" der → alacaklı onaylar (çift taraflı; "onay bekliyor" / "onaylandı" durumları)
- [ ] Kısmi ödeme işaretleme

### Hatırlatmalar
- [ ] Gerçek üyelere uygulama içi push bildirimi
- [ ] Hayalet üyeler için paylaşılabilir özet metni (WhatsApp'a yapıştır)
- [ ] Manuel tetikli hatırlatma (kurucu gönderir)

### Harcama Geçmişi / Aktivite Akışı
- [ ] Grup bazında kronolojik işlem listesi
- [ ] "Kim ne ekledi, kim ödedi" aktivite akışı
- [ ] Masrafa göre filtreleme (kategori, tarih, üye)

### Onboarding & Dil
- [ ] Çok dilli altyapı (i18n) baştan kurulu (diller sonra eklenir)
- [ ] İlk açılışta demo / örnek grup gösterimi
- [ ] Kısa tanıtım turu (birkaç ekran)

---

## Post-MVP (Sonraki Sürümler)

### v1.1 — Fiş & Fotoğraf
- [ ] Masrafa fotoğraf / fiş ekleme
- [ ] Fotoğraftan tutar okuma (OCR — değerlendirme aşamasında)

### v1.2 — Tekrarlayan Masraf
- [ ] Tekrarlayan masraf tanımlama (haftalık / aylık)
- [ ] Sunucu taraflı otomatik masraf oluşturma (Supabase cron / Edge Function)
- [ ] ⚠️ *Not: Bu özellik sunucu zamanlayıcısı gerektirdiği için en son eklenir*

---

## Monetizasyon

**Model:** Freemium, **reklam yok** (hiçbir katmanda). İki Pro kanalı:

**1) Grup Pro** — o grup için Pro açar (sosyal / paylaşılan)
- Tek seferlik kilit açma; grup kalıcı Pro
- Gruptaki herhangi bir gerçek (hayalet olmayan) üye satın alabilir
- Entitlement sunucuda `group_id`'ye yazılır; satın alanın hesabına bağlı kalmaz
- Pro bedeli grupta gider olarak paylaştırılabilir (opsiyonel akış)

**2) User Pro** — kullanıcının TÜM gruplarında Pro açar + kişisel özellikler (bireysel)
- Tüm gruplardaki bakiye tek ekranda + kişisel harcama analizi
- Free'deki grup oluşturma limitini kaldırır

**Free vs Pro:**

| | Free | Pro (grup veya user) |
|---|---|---|
| Üye sayısı | Sınırsız | Sınırsız |
| Gruba katılma | Sınırsız | Sınırsız |
| **Grup oluşturma** | **En fazla 5** | Sınırsız |
| Çekirdek (bölüşme, kur, netleştirme, hatırlatma, kategori, geçmiş) | ✅ | ✅ |
| Fiş/OCR, tekrarlayan masraf, dışa aktarma, gelişmiş grafik | ❌ | ✅ |
| Reklam | Yok | Yok |

---

## Mimari & Teknoloji

| Katman | Karar |
|---|---|
| **Framework** | React Native + Expo |
| **Build** | EAS Build (bulut — Mac gerekmez) |
| **Backend** | Supabase (auth + database + storage) |
| **Anlık Sync** | Supabase Realtime |
| **Push Bildirim** | Expo Notifications |
| **Kur API** | Frankfurter API (ücretsiz, key gerekmez) |
| **Test (geliştirme)** | Expo Go — iPhone 14 |

---

## Zorunlu Maliyetler

| Kalem | Tutar | Periyot |
|---|---|---|
| Apple Developer Program | $99 | Yıllık |
| Google Play Geliştirici | $25 | Tek seferlik |
| Expo EAS Build | $0 | Ücretsiz katman (ay/15 build) |
| Supabase | $0 | Ücretsiz katman |
| Kur API | $0 | Ücretsiz |
| **Toplam (ilk yıl)** | **~$124** | |

---

## Çözülen Kararlar

- ✅ **Monetizasyon:** Freemium + grup bazlı Pro (yukarı bak)
- ✅ **Limit:** Free'de sınırsız grup/üye; Pro özellik bazlı
- ✅ **Dil:** i18n altyapısı baştan, diller sonra eklenir
- ✅ **Onboarding:** Demo grup + kısa tanıtım turu

---

## Açık Sorular (netleştirilecek)

> ✅ **Keşif tamamlandı — açık soru kalmadı.** Yeni konular çıkarsa buraya eklenir.

**Tüm çözülen kararlar:** Giriş = Google+Apple · IBAN hiç saklanmaz (anlık iste-paylaş) · Alt-küme bölüşme · Hayalet→gerçek bağlanır (geçmiş taşınır) · "Ödendi" çift taraflı onay · Hesap adıyla görünüm · Üye çıkışı = eski üye (bakiye/geçmiş kalır, tam silme bakiye sıfırken) · Davet = linkle anında katılım

**Zorunlu (store kuralı — tercih değil, gereklilik)**
- Uygulama içi **hesap silme** (Apple, hesap açan uygulamalarda zorunlu kılar)
- **Gizlilik Politikası + Kullanım Şartları** URL'leri (her iki store da ister) — Vercel'de barındırılabilir
- Veri dışa aktarma / silme (KVKK/GDPR hakkı)

**Varsayılan atanan**
- Yuvarlama: kalan kuruş ödeyene gider
- Avatar: renkli baş harf; foto sonra/Pro
- Düzenleme/silme: sahibi + yönetici, hepsi aktivite akışına yazılır
- Sync: Supabase Realtime; tam offline post-MVP
- Grup arşivleme: var; silme yalnız bakiye sıfırken + onayla
- Masraf notu: opsiyonel serbest metin alanı (MVP'de var)

---

*Son güncelleme: Mayıs 2026 — Kapsam + monetizasyon oturumu*
