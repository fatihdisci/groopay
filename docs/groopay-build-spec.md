# Groopay — Claude Code Build Spec (v1)

> Bu belge Claude Code'a verilecek **inşa planıdır.** Kapsam kararları için `groopay-scope.md`'ye bakılır; bu belge onları teknik plana çevirir.
> Dil: arayüz metinleri Türkçe (i18n ile), kod/tanımlayıcılar İngilizce.

---

## 0. Özet & Stack

**Groopay:** Küçük gruplar için takip-amaçlı masraf bölüşme uygulaması. Gerçek para hareketi yok.

| Katman | Teknoloji |
|---|---|
| Framework | React Native + **Expo (SDK güncel)** |
| Navigasyon | **Expo Router** (dosya tabanlı) |
| Dil/TS | TypeScript (strict) |
| Backend | **Supabase** (Postgres + Auth + Realtime + Storage + Edge Functions) |
| Auth | Google + Apple (Supabase OAuth) |
| Build | **EAS Build** (bulut, Mac gerekmez) |
| Push | **Expo Notifications** |
| Kur | Frankfurter API (ücretsiz, key yok) — gerekirse open.er-api.com'a geçilebilir |
| Ödeme/IAP | **RevenueCat** (receipt doğrulama + entitlement; raw StoreKit/Billing yerine) |
| i18n | `i18next` + `react-i18next` + `expo-localization` |
| Durum yönetimi | React Query (server state) + Zustand (lokal UI state) |

**Neden RevenueCat:** Solo bir geliştiricinin Apple/Google makbuzlarını sunucuda kendi başına doğrulaması çok hatalıdır. RevenueCat bunu üstlenir, iki platformu tek API'de birleştirir ve webhook ile Supabase'e entitlement yazmamızı sağlar. Ücretsiz katmanı küçük gelir hacmine fazlasıyla yeter.

---

## 1. Veri Modeli (Supabase / Postgres)

### 1.1 Tasarım ilkeleri

- **Hayalet üye desteği için her şey `group_members.id`'ye bağlanır, `user_id`'ye değil.** Bir hayaletin `user_id`'si yoktur ama üyelik satırı vardır. Masraf payları, ödeyen, netleşmeler hep üyelik satırına işaret eder. Hayalet gerçek hesaba bağlanınca o satıra `user_id` yazılır; **tüm geçmiş otomatik taşınır.**
- **Para birimi:** Masraf hangi para biriminde girildiyse **orijinal haliyle** saklanır (amount + currency). Asla TRY'ye veya başka bir para birimine çevrilip kaydedilmez. Bakiye/borç her zaman orijinal para biriminde hesaplanır; farklı para birimleri ayrı gösterilir. Çevrim **sadece görüntüleme içindir:** kullanıcı isterse canlı kurla "≈ X TRY" gösterilir, bu değer hiçbir yere kaydedilmez. Grup `base_currency` artık sadece varsayılan görüntüleme para birimidir (hesap temeli değil).
- **Soft delete:** Masraflar `deleted_at` ile silinir (geçmiş/denetim için).
- **Bakiye türetilmiştir, saklanmaz:** Bakiye her zaman masraflar + onaylı netleşmelerden hesaplanır.

### 1.2 SQL Şeması (başlangıç migration'ı)

```sql
-- ============ ENUMS ============
create type member_role as enum ('founder', 'member');
create type settlement_status as enum ('pending', 'confirmed', 'rejected');
create type split_type as enum ('equal', 'custom', 'subset');

-- ============ PROFILES (auth.users uzantısı) ============
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_color text not null default '#6C5CE7',
  locale text not null default 'tr',
  expo_push_token text,
  user_pro boolean not null default false,
  user_pro_purchased_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============ GROUPS ============
create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  photo_url text,
  base_currency text not null default 'TRY',             -- varsayılan görüntüleme para birimi (hesap temeli DEĞİL)
  created_by uuid not null references profiles(id),
  is_pro boolean not null default false,           -- grup bazlı Pro
  pro_purchased_by uuid references profiles(id),
  pro_purchased_at timestamptz,
  is_demo boolean not null default false,          -- onboarding demo grubu
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============ GROUP MEMBERS (hibrit: hayalet + gerçek) ============
create table group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid references profiles(id),            -- NULL => hayalet üye
  display_name text not null,                      -- hayalet için zorunlu; gerçek için profil adının kopyası
  role member_role not null default 'member',
  is_active boolean not null default true,         -- false => "eski üye"
  created_at timestamptz not null default now(),
  joined_at timestamptz,
  unique (group_id, user_id)                        -- bir kullanıcı bir grupta tek üyelik
);

-- ============ GROUP INVITES (linkle katılım) ============
create table group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  token text not null unique,
  created_by uuid not null references profiles(id),
  expires_at timestamptz,                           -- NULL => süresiz
  created_at timestamptz not null default now()
);

-- ============ EXPENSES ============
create table expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  description text not null,
  note text,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null,
  category text not null default 'other',
  split_type split_type not null,
  paid_by uuid not null references group_members(id),
  expense_date date not null default current_date,
  created_by uuid not null references group_members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz                            -- soft delete
);

-- ============ EXPENSE SPLITS (kim ne kadar pay aldı) ============
create table expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references expenses(id) on delete cascade,
  member_id uuid not null references group_members(id),
  share_amount numeric(14,2) not null check (share_amount >= 0),
  unique (expense_id, member_id)
);

-- ============ SETTLEMENTS (çift taraflı "ödendi") ============
create table settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  from_member uuid not null references group_members(id),  -- borçlu (öder)
  to_member uuid not null references group_members(id),    -- alacaklı (alır)
  amount_base numeric(14,2) not null check (amount_base > 0),
  status settlement_status not null default 'pending',
  marked_by uuid not null references group_members(id),
  confirmed_by uuid references group_members(id),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  note text
);

-- ============ ACTIVITY LOG (aktivite akışı) ============
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  actor_member_id uuid references group_members(id),
  action_type text not null,           -- 'expense_added','expense_edited','expense_deleted',
                                        -- 'settlement_marked','settlement_confirmed','member_joined', vs.
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- indeksler
create index idx_members_group on group_members(group_id);
create index idx_members_user on group_members(user_id);
create index idx_expenses_group on expenses(group_id) where deleted_at is null;
create index idx_splits_expense on expense_splits(expense_id);
create index idx_splits_member on expense_splits(member_id);
create index idx_settlements_group on settlements(group_id);
create index idx_activity_group on activity_log(group_id);
```

### 1.3 RLS Politikaları (KRİTİK — recursion tuzağına dikkat)

> **Tuzak:** `group_members` üzerindeki RLS politikası, doğrudan `group_members`'ı sorgularsa Postgres **sonsuz recursion** hatası verir. Çözüm: üyelik kontrolünü `SECURITY DEFINER` bir fonksiyonda yapmak (RLS'i baypas eder, recursion'ı kırar).

```sql
-- Üyelik kontrol helper'ı (SECURITY DEFINER => RLS baypas, recursion yok)
create or replace function is_member_of(gid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

-- RLS'i aç
alter table profiles enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table group_invites enable row level security;
alter table expenses enable row level security;
alter table expense_splits enable row level security;
alter table settlements enable row level security;
alter table activity_log enable row level security;

-- PROFILES: herkes kendi profilini görür/günceller
create policy "own profile read"   on profiles for select using (id = auth.uid());
create policy "own profile update" on profiles for update using (id = auth.uid());
create policy "own profile insert" on profiles for insert with check (id = auth.uid());

-- GROUPS: sadece üye olunan gruplar
create policy "member can read group" on groups
  for select using (is_member_of(id));
create policy "any auth can create group" on groups
  for insert with check (created_by = auth.uid());
create policy "member can update group" on groups
  for update using (is_member_of(id));

-- GROUP_MEMBERS: aynı gruptaki üyeler birbirini görür
create policy "members read same group" on group_members
  for select using (is_member_of(group_id));
create policy "members manage same group" on group_members
  for all using (is_member_of(group_id)) with check (is_member_of(group_id));

-- EXPENSES / SPLITS / SETTLEMENTS / ACTIVITY: grup üyeliğine bağlı
create policy "expenses by membership" on expenses
  for all using (is_member_of(group_id)) with check (is_member_of(group_id));
create policy "splits by membership" on expense_splits
  for all using (
    is_member_of((select group_id from expenses where id = expense_id))
  ) with check (
    is_member_of((select group_id from expenses where id = expense_id))
  );
create policy "settlements by membership" on settlements
  for all using (is_member_of(group_id)) with check (is_member_of(group_id));
create policy "activity by membership" on activity_log
  for select using (is_member_of(group_id));

-- GROUP_INVITES: üyeler oluşturur; token ile katılım Edge Function üzerinden (RLS baypas)
create policy "invites read by member" on group_invites
  for select using (is_member_of(group_id));
create policy "invites create by member" on group_invites
  for insert with check (is_member_of(group_id));
```

> **Not — linkle katılım:** Henüz üye olmayan biri token ile gruba katılırken RLS onu engeller (daha üye değil). Bu yüzden katılım bir **Edge Function** (`join-via-invite`) ile yapılır: token doğrulanır, `group_members`'a satır eklenir (fonksiyon service-role ile çalışır). Hayalet bağlama (claim) da burada ele alınır: eğer grupta `user_id IS NULL` bir hayalet varsa ve katılan kişi onu seçerse, o satırın `user_id`'si set edilir (yeni satır açılmaz → geçmiş taşınır).

---

## 2. Çekirdek Hesaplama Mantığı (saf, test edilebilir fonksiyonlar)

Bu mantık UI'dan bağımsız, saf TS fonksiyonları olarak yazılır (`/lib/finance/`), birim testleri yazılır.

### 2.1 Bölüşme (split) hesaplama — kuruş hatasız

Tutar **tam sayı minor unit** (kuruş) ile hesaplanır, sonra ondalığa çevrilir. Eşit bölüşmede kalan kuruş **ödeyene** verilir.

```ts
// amountMinor: kuruş cinsinden toplam (örn. 100.00 TL => 10000)
// memberIds: bölüşmeye dahil üyeler
// equalSplit: kalanı payer'a ekleyerek eşit dağıt
function splitEqual(amountMinor: number, memberIds: string[], payerId: string) {
  const base = Math.floor(amountMinor / memberIds.length);
  let remainder = amountMinor - base * memberIds.length;
  return memberIds.map((id) => {
    let share = base;
    if (remainder > 0 && id === payerId) { share += remainder; remainder = 0; }
    // payer dahil değilse kalanı ilk üyeye ver (fallback)
    return { memberId: id, shareMinor: share };
  });
}
```
- **Custom:** kullanıcı her üyeye tutar/oran girer; toplam = amount doğrulanır (tolerans 0).
- **Subset:** sadece seçili üyeler arasında `splitEqual`/custom uygulanır.

### 2.2 Canlı görüntüleme çevrimi (FX display-only)

Masraf orijinal para biriminde saklanır. Çevrim **sadece kullanıcı istediğinde, ekranda göstermek için** yapılır; hiçbir yere kaydedilmez.

```ts
// SADECE görüntüleme için — Supabase'e YAZILMAZ, masrafın/split'in değerini DEĞİŞTİRMEZ:
const rate = await fetchRate(expenseCurrency, group.baseCurrency); // Frankfurter canlı kur
const approximate = round2(amount * rate);
// Ekranda: "≈ {approximate} TRY (bugünkü kur, bilgi amaçlı)" — opsiyonel, kapatılabilir.
```
- `fetchRate(from, to)`: `from === to` ise 1 döner (API çağrısı yapılmaz).
- Frankfurter: `GET /v1/latest?base=XXX&symbols=YYY`, API key yok, TRY dahil ECB para birimlerini destekler.
- React Query ile cache'le (staleTime ~1 saat — günlük kur yeterli).
- API hatasında/desteklenmeyen para biriminde: sessizce çevrimi gösterme, sadece orijinal tutarı göster. Uygulamayı asla çökertme.

### 2.3 Bakiye hesaplama (türetilmiş, para birimi bazında)

Her üye için **her para biriminde ayrı ayrı** net bakiye hesaplanır. Çapraz para birimi toplama YAPILMAZ.

```
// Her currency için:
net(m, currency) = (m'nin ödediği toplam: expenses.amount where paid_by=m, currency=c, deleted_at null)
                 - (m'nin pay toplamı: expense_splits.share_amount where member_id=m, ilgili expense'in currency'si=c)
                 + (m'nin from_member olduğu CONFIRMED settlement toplamı, currency=c)
                 - (m'nin to_member olduğu CONFIRMED settlement toplamı, currency=c)
```
- `net > 0` => alacaklı (para alacak), `net < 0` => borçlu. Her para birimi için tüm net'lerin toplamı = 0.
- **Pending settlement bakiyeyi değiştirmez**, sadece "onay bekliyor" rozeti gösterir.
- Ekranda: "Ali sana 50 EUR + 200 TRY borçlu" gibi para birimi bazında ayrı satırlar.
- Opsiyonel: kullanıcı "TRY karşılığını göster" derse, her birim için canlı kurla `≈ X TRY` gösterilir (kaydedilmez).

### 2.4 Borç sadeleştirme (min cash flow — greedy, para birimi bazında)

Her para birimi için ayrı ayrı sadeleştirme yapılır. Farklı para birimleri karıştırılmaz.

```ts
// nets: { memberId, net }[]  (tek bir para birimi içinde, toplamı 0)
// En büyük alacaklı ile en büyük borçluyu eşle, tekrarla.
function simplifyDebts(nets) {
  const creditors = nets.filter(n => n.net > 0).sort((a,b)=>b.net-a.net);
  const debtors   = nets.filter(n => n.net < 0).sort((a,b)=>a.net-b.net);
  const tx = [];
  let i=0, j=0;
  const c = creditors.map(x=>({...x})); const d = debtors.map(x=>({...x}));
  while (i < c.length && j < d.length) {
    const pay = Math.min(c[i].net, -d[j].net);
    tx.push({ from: d[j].memberId, to: c[i].memberId, amount: round2(pay) });
    c[i].net -= pay; d[j].net += pay;
    if (c[i].net <= 0.001) i++;
    if (d[j].net >= -0.001) j++;
  }
  return tx; // "en az işlemle kim kime öder" (tek para birimi)
}
```
- Her para birimi için ayrı simplifyDebts çağrısı yapılır.
- Ekranda hem **sadeleştirilmiş öneri** (para birimi bazında) hem istenirse **ham bakiye** gösterilir.

---

## 3. Ekranlar & Navigasyon

**Tab yapısı (Expo Router):** `Gruplar` · `Aktivite` · `Hesap`

```
app/
  (auth)/sign-in
  (onboarding)/intro          // tanıtım turu + otomatik demo grup
  (tabs)/
    groups/index              // grup listesi (home)
    groups/[id]/index         // grup detay: Bakiyeler | Masraflar (sekmeler)
    groups/[id]/add-expense    // masraf ekle/düzenle
    groups/[id]/settle         // netleşme (öneri + "ödedim/onayla")
    groups/[id]/members        // üye yönetimi (hayalet ekle, davet linki, rol, çıkar)
    groups/[id]/iban-request   // IBAN iste/paylaş (anlık)
    activity/index            // tüm gruplar aktivite akışı (User Pro: kişisel özet)
    account/index             // profil, dil, Pro durumu, restore, hesap silme, export
  paywall                     // Grup Pro + User Pro
  join/[token]                // davet linki açılışı
```

**Ekran sorumlulukları (özet):**

| Ekran | İşlev |
|---|---|
| Sign-in | Google + Apple ile giriş; ilk girişte profil oluştur |
| Intro/Onboarding | 3-4 ekran tanıtım turu + silinebilir "Örnek Grup" otomatik oluştur |
| Gruplar | Üye olunan gruplar, her birinde net bakiye özeti; "+ Grup" (free'de 5 limiti kontrolü) |
| Grup detay | Sekme 1: bakiyeler (kim kime); Sekme 2: masraf listesi + filtre; Realtime |
| Masraf ekle/düzenle | Tutar, para birimi, kategori, ödeyen, bölüşme (equal/custom/subset), tarih, not; opsiyonel canlı kur gösterimi |
| Netleşme | Sadeleştirilmiş öneri listesi; borçlu "Ödedim" → alacaklıya bildirim → "Onayla" |
| Üyeler | Hayalet ekle, davet linki üret/paylaş, rol, "eski üye"ye al; bakiye sıfırsa tam sil |
| IBAN iste | Borçlu istek atar → alacaklıya bildirim → alacaklı IBAN'ı o an girer → borçluya gösterilir; **saklanmaz** |
| Aktivite | Kronolojik akış; User Pro'da tüm grupların birleşik bakiyesi + kişisel analiz |
| Hesap | Profil (ad, avatar rengi), dil, Pro durumu, "Satın alımları geri yükle", **hesap silme**, veri dışa aktarma |
| Paywall | Grup Pro (tek sefer, bu grubu açar, "masrafı gruba böl" opsiyonu) + User Pro |
| join/[token] | Daveti aç → (varsa) hayalet seç & bağlan → gruba katıl (Edge Function) |

---

## 4. Monetizasyon Entegrasyonu (RevenueCat + Supabase)

- **User Pro:** RevenueCat standart kullanıcı entitlement'ı (`user_pro`). Satın alınca app-user-id = Supabase `auth.uid()`.
- **Grup Pro:** Satın alma anında RevenueCat'e `group_id` metadata olarak geçilir. RevenueCat **webhook → Supabase Edge Function (`revenuecat-webhook`)** → ilgili `groups.is_pro = true`, `pro_purchased_by`, `pro_purchased_at` yazılır. Entitlement böylece **gruba** bağlanır, satın alanın hesabına değil.
- **Free kapısı:** Grup oluşturmadan önce, kullanıcının `created_by = auth.uid()` ve `is_demo = false` grup sayısı kontrol edilir; **5'i aşıyorsa** paywall (User Pro) gösterilir.
- **Pro özellik kapıları:** Fiş/OCR, tekrarlayan masraf, dışa aktarma, gelişmiş grafik → `group.is_pro OR profile.user_pro` kontrolü (post-MVP özellikler ama kapı mantığı baştan kurulur).
- **"Masrafı gruba böl":** Grup Pro alınınca opsiyonel akış: Pro bedeli bir masraf olarak gruba eklenir (kategori: Diğer), seçili üyelere bölünür.
- Zorunlu: "Satın alımları geri yükle" (Apple şartı) ekranı.

---

## 5. Bildirimler (Expo Notifications)

- Giriş sonrası push izni iste, token'ı `profiles.expo_push_token`'a yaz.
- **Tetikleyiciler** (Edge Function'lardan Expo Push API ile):
  - Seni ilgilendiren yeni masraf eklendi
  - Sana ödeme işaretlendi ("X ödedim dedi, onayla")
  - Ödemen onaylandı
  - IBAN isteği geldi
  - Gruba yeni katılım
  - Manuel hatırlatma (kurucu tetikler)
- **Hayalet üyeler** bildirim alamaz → onlar için **WhatsApp özeti**: paylaşılabilir metin üret (kişi bazında "X'e Y TL borçlusun" + grup özeti), `Share` API ile WhatsApp'a yapıştır.

---

## 6. i18n

- `i18next` baştan kurulur; tüm metinler `t('key')` ile. Varsayılan `tr`, fallback `tr`.
- `expo-localization` ile cihaz dili okunur; kullanıcı Hesap'tan değiştirebilir (`profiles.locale`).
- `locales/tr.json` doldurulur; `en.json` iskelet bırakılır (sonra çevrilir).
- Para/tarih biçimleri `Intl` ile locale'e göre.

---

## 7. Store-Hazırlık (zorunlu)

- **Uygulama içi hesap silme:** Hesap ekranında; `delete-account` Edge Function tüm kullanıcı verisini siler (auth + profil + üyelikleri). Apple bunu zorunlu kılar.
- **Gizlilik Politikası + Kullanım Şartları:** Vercel'de barındır (URL'ler store başvurusunda zorunlu). KVKK + GDPR metni (IBAN saklanmadığı, verinin nerede tutulduğu).
- **Veri dışa aktarma:** Kullanıcının verisini JSON/CSV verən "Verimi indir" (KVKK/GDPR).
- İkon, splash, ekran görüntüleri, App Store/Play açıklamaları.
- iOS 15+ / Android 8+ hedef; dikey (portrait) öncelikli.

---

## 8. Faz Faz Görev Listesi (Claude Code sırası)

Her faz sonunda **kabul kriteri** sağlanmadan sonrakine geçme.

### Faz 0 — Proje kurulumu
- Expo + Expo Router + TypeScript (strict) iskeleti
- Supabase client, `.env` (anon key), env yönetimi
- React Query + Zustand kurulumu
- i18n iskeleti (`tr` varsayılan), design token'ları (renk, spacing, tipografi)
- **Kabul:** Boş uygulama iPhone'da Expo Go ile açılıyor, tab navigasyonu çalışıyor.

### Faz 1 — Auth + Profil + Onboarding
- Google + Apple ile giriş (Supabase OAuth)
- İlk girişte `profiles` satırı oluştur (display_name, avatar rengi ata)
- Onboarding turu + otomatik "Örnek Grup" (is_demo=true)
- **Kabul:** Giriş/çıkış çalışıyor, profil oluşuyor, demo grup görünüyor.

### Faz 2 — Veri modeli
- Tüm tabloları + enum'ları + indeksleri migration olarak yaz
- `is_member_of` fonksiyonu + tüm RLS politikaları
- **Kabul:** RLS testi — A kullanıcısı B'nin grubunu göremiyor; recursion hatası yok.

### Faz 3 — Gruplar + Üyeler
- Grup CRUD (oluştur, düzenle, arşivle)
- Free 5-grup kapısı
- Hayalet üye ekleme
- Davet linki üret + `join-via-invite` Edge Function + hayalet bağlama (claim)
- Üye çıkışı → "eski üye"; tam silme bakiye sıfırken
- **Kabul:** İki gerçek cihazla: davet linkiyle katılım çalışıyor; hayalet bağlanınca geçmiş taşınıyor.

### Faz 4 — Masraflar
- Masraf ekle/düzenle/sil (soft delete)
- Bölüşme: equal / custom / subset (kuruş hatasız, birim testli)
- Kategoriler, not, tarih
- Çoklu para birimi: orijinal para biriminde saklama + opsiyonel canlı kur gösterimi (Frankfurter, sadece görüntüleme)
- **Kabul:** Çoklu para birimli masraf ekleniyor; Supabase'de SADECE amount + currency yazılı (TRY değeri YOK); ekranda istenirse "≈ X TRY (canlı)" görünüyor; paylar toplamı tam tutuyor; soft delete çalışıyor.

### Faz 5 — Bakiye + Sadeleştirme + Aktivite
- Bakiye hesaplama (saf fonksiyon + test)
- Borç sadeleştirme (greedy + test)
- Grup detay bakiyeler sekmesi + Realtime
- Aktivite akışı (her işlem `activity_log`'a)
- **Kabul:** Net'lerin toplamı 0; sadeleştirilmiş öneri doğru; canlı güncelleme çalışıyor.

### Faz 6 — Netleşme + IBAN + Bildirim + WhatsApp
- Çift taraflı settle (pending → confirmed)
- IBAN iste/paylaş (anlık, saklamasız)
- Expo push token + tetikleyiciler (Edge Function'lar)
- WhatsApp özeti üretici
- **Kabul:** "Ödedim → onayla" akışı bakiyeyi güncelliyor; bildirimler düşüyor; özet paylaşılıyor.

### Faz 7 — Monetizasyon
- RevenueCat kurulumu (iOS+Android ürünleri)
- User Pro + Grup Pro entitlement; `revenuecat-webhook` Edge Function
- Paywall ekranı + "masrafı gruba böl" + "restore"
- Pro özellik kapıları
- **Kabul:** Test satın alma → grup Pro oluyor (group_id'ye yazılıyor); restore çalışıyor.

### Faz 8 — Store-hazırlık + cila
- Hesap silme + veri dışa aktarma Edge Function'ları
- Gizlilik/Şartlar URL'leri (Vercel)
- İkon, splash, ekran görüntüleri, mağaza metinleri
- Erişilebilirlik (vektör ikonlar, kontrast, reduced-motion), boş/hata durumları
- **Kabul:** EAS Build ile iOS + Android derleniyor; TestFlight/Internal Testing'e yükleniyor.

---

## 9. Önerilen Proje Yapısı

```
groopay/
  app/                      # Expo Router ekranları (yukarıdaki yapı)
  lib/
    supabase/               # client, queries, types (generated)
    finance/                # split, fx, balance, simplify (SAF + testli)
    i18n/
    revenuecat/
  components/               # paylaşılan UI
  hooks/
  locales/ tr.json en.json
  supabase/
    migrations/             # SQL
    functions/              # join-via-invite, revenuecat-webhook, delete-account, send-push, export-data
  CLAUDE.md                 # stack kuralları, güvenlik, TR-default (mevcut ekosistemine uygun)
```

---

## 10. Riskler & Notlar

- **RLS recursion:** `is_member_of` SECURITY DEFINER şart (Bölüm 1.3). En sık yapılan hata.
- **Para hassasiyeti:** Hesaplamayı float ile yapma; kuruş (integer minor unit) ile yap, `numeric` sakla.
- **FX:** Masraf orijinal para biriminde saklanır; çevrim sadece görüntüleme içindir, hiçbir yere kaydedilmez. Kur oynaklığından etkilenmez çünkü hesap orijinal birimdedir.
- **Grup Pro entitlement:** Mutlaka sunucu tarafında (`group_id`), istemcide değil. Webhook doğrulaması şart.
- **Demo grup** istatistiklere/limite sayılmaz (`is_demo` filtresi).
- **Hayalet bağlama** yeni satır AÇMAZ; mevcut satıra `user_id` yazar.

---

*v1 — Kapsam oturumu sonrası. Değişiklikler bu belgeye işlenir; kapsam kararları için `groopay-scope.md`.*
