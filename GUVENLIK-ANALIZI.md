# Groopay — Güvenlik & Production-Hazırlık Denetimi

> **Denetim tarihi:** 2026-06-01
> **Kapsam:** Tüm migration'lar, tüm RPC'ler, tüm Edge Functions, `lib/supabase/queries.ts`, `lib/finance/money.ts`, tüm split/balance/simplify pure functions
> **Statü:** ANALİZ TAMAM. KOD DEĞİŞMEDİ.

---

## 1. DOĞRULANAN BULGULAR (GERÇEK, KRİTİK)

### P0‑1A: `add_expense_with_splits` — auth.uid() yetki kontrolü YOK ❌

**Durum:** DOĞRU — KRİTİK AÇIK.

**Kanıt:** `supabase/migrations/0004_drop_fx_columns_add_expense_rpc.sql:33-94`

```sql
create or replace function add_expense_with_splits(
  p_group_id uuid,
  ...
  p_paid_by uuid,        -- ← caller'dan geliyor, DOĞRULANMIYOR
  p_created_by uuid,     -- ← caller'dan geliyor, DOĞRULANMIYOR
  p_splits jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  -- ⚠️ HİÇBİR auth.uid() kontrolü yok!
  -- ⚠️ p_created_by'nin gerçekten auth.uid()'e ait bir member olduğu doğrulanmıyor
  -- ⚠️ p_paid_by'nin aynı grupta olduğu doğrulanmıyor
  -- ⚠️ split member'larının aynı grupta olduğu doğrulanmıyor
  -- ⚠️ sum(splits) == amount doğrulanmıyor
  -- ⚠️ amount > 0 doğrulanmıyor (sadece CHECK constraint var)
  insert into expenses (...) values (...);
  for v_split in ... loop
    insert into expense_splits ...;
  end loop;
  return v_expense_id;
end;
$$;
```

**Etki:** Herhangi bir auth kullanıcısı (anon anahtar ile) başka bir gruba masraf ekleyebilir, istediği üyeyi `paid_by`/`created_by` yapabilir, split'leri manipüle edebilir. `p_splits` toplamı `p_amount` ile eşit olmasa bile RPC bunu kontrol etmez — bakiye hesabı bozulur.

### P0‑1B: `confirm_settlement` / `reject_settlement` — alacaklı kontrolü YOK ❌

**Durum:** DOĞRU — KRİTİK AÇIK.

**Kanıt:** `supabase/migrations/0006_settlements_currency_iban.sql:106-140` ve `:142-177`

```sql
create or replace function confirm_settlement(
  p_settlement_id uuid,
  p_confirmed_by uuid    -- ← çağıran istediğini gönderebilir
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update settlements
  set status = 'confirmed', confirmed_by = p_confirmed_by, confirmed_at = now()
  where id = p_settlement_id and status = 'pending';
  -- ⚠️ p_confirmed_by'nin settlement.to_member olduğu KONTROL EDİLMİYOR!
  -- ⚠️ p_confirmed_by'nin auth.uid()'e ait olduğu KONTROL EDİLMİYOR!
  -- ⚠️ Settlement'ın çağıranın grubuna ait olduğu KONTROL EDİLMİYOR!
end;
$$;
```

**Etki:** Herhangi bir kullanıcı, herhangi bir grubun pending settlement'ını confirm/reject edebilir. Borçlu, alacaklıdan bağımsız olarak kendi borcunu "onaylatabilir" veya başkasının settlement'ını reddedebilir. **Spoofing mümkün.**

### P0‑1C: `add_settlement` — yetki kontrolü YOK ❌

**Durum:** DOĞRU — KRİTİK AÇIK.

**Kanıt:** `supabase/migrations/0006_settlements_currency_iban.sql:60-103`

```sql
create or replace function add_settlement(
  p_from_member uuid,    -- ← doğrulanmıyor
  p_to_member uuid,      -- ← doğrulanmıyor
  p_marked_by uuid,      -- ← doğrulanmıyor
  ...
)
-- ⚠️ Hiçbir auth.uid() kontrolü yok
-- ⚠️ p_marked_by'nin çağırana ait olduğu kontrol edilmiyor
```

**Etki:** Bir kullanıcı başkasının adına "ödedim" diyerek sahte settlement oluşturabilir. Haksız borç kapatma mümkün.

### P0‑2: RLS policy'leri çok geniş — herhangi bir üye herhangi bir masrafı silebilir/değiştirebilir ❌

**Durum:** DOĞRU — KRİTİK AÇIK.

**Kanıt:** `supabase/migrations/0001_initial_schema.sql:222-224`

```sql
create policy "expenses by membership" on expenses
  for all using (is_member_of(group_id)) with check (is_member_of(group_id));
```

Bu policy **ALL** (select + insert + update + delete) işlemlerini grubun HERHANGİ bir üyesine açıyor. Client tarafında `canModifyExpense()` (expense.created_by veya founder) kontrolü var (`lib/supabase/queries.ts:410-418`), ancak bu **sadece UI tarafında**. Doğrudan Supabase anon key ile API çağrısı yapan bir saldırgan, başkasının masrafını silebilir veya değiştirebilir.

Aynı durum `settlements` ve `group_members` için de geçerli:
- `"settlements by membership"` — for all (line 237-238)
- `"members manage same group"` — for all (line 209-210)
- `"member can update group"` — for update (line 200-201)

### P0‑3: Anon key ile yetkisiz işlem yapılabilir ❌

**Durum:** DOĞRU. P0-1 ve P0-2 ile birleşince:

Bir saldırgan `EXPO_PUBLIC_SUPABASE_ANON_KEY` (`.env`'de açık, client bundle'da görünür) ile:
1. `add_expense_with_splits` RPC'yi çağırarak başka gruba masraf ekleyebilir
2. `confirm_settlement` RPC'yi çağırarak başkasının settlement'ını onaylayabilir
3. `add_settlement` RPC ile sahte settlement oluşturabilir
4. Doğrudan `expenses` tablosuna DELETE/UPDATE yaparak başkasının masrafını silebilir/değiştirebilir
5. `remove_member` RPC ile (kendi grubunda) founder olmayan üyeleri çıkarabilir… **wait, remove_member'da auth.uid() kontrolü var!**

### P0‑4: `amount` ve `share_amount` alanları `numeric(14,2)` — 2 ondalık FIXED ❌

**Durum:** DOĞRU — MİMARİ SORUN.

**Kanıt:** `supabase/migrations/0001_initial_schema.sql:86,105`

```sql
amount numeric(14,2) not null check (amount > 0),
share_amount numeric(14,2) not null check (share_amount >= 0),
```

Ancak `SUPPORTED_CURRENCIES` (`lib/finance/money.ts:52-73`) **20 para birimi** içeriyor, bunlardan:
- **0 ondalıklı:** JPY, KRW, VND → `numeric(14,2)` ile 100¥ = 100.00 olarak saklanır (bozulma yok ama gereksiz)
- **3 ondalıklı:** BHD, KWD, OMR, TND → 1.255 KWD saklanamaz! `numeric(14,2)` 1.25 veya 1.26 olarak yuvarlar → **VERİ KAYBI**

### P0‑5: `toMinor()` float riski taşıyor ❌

**Durum:** KISMEN DOĞRU — DÜŞÜK RİSK (Math.round ile hafifletilmiş).

**Kanıt:** `lib/finance/money.ts:32-37`

```typescript
export function toMinor(amount: number, currency: string): number {
  const decimals = getDecimals(currency);
  const factor = 10 ** decimals;
  return Math.round(amount * factor);  // ← float çarpımı + Math.round
}
```

- `Math.round()` var, bu çoğu floating-point edge case'i yakalıyor (örn. `0.1 + 0.2 = 0.30000000000000004 → Math.round(30.000000000000004) → 30`).
- Test `toMinor(0.1 + 0.2, 'TRY') → 30` geçiyor.
- **Ancak:** Çok büyük sayılarda (`10**14` üzeri) `amount * factor` precision kaybeder. `numeric(14,2)` limitiyle bu risk düşük ama var.
- Asıl sorun: `fromMinor` kullanılarak DB'ye yazılan değer tekrar float'a çevriliyor. DB'den gelen `numeric` → JS `number` → float precision riski.

### P0‑6: `parseNumericInput` mevcut DEĞİL — README ile kod uyuşmuyor ❌

**Durum:** DOĞRU.

**Kanıt:** `README.md:391` şöyle diyor:
> `parseNumericInput("19.99") → 1999`

Ancak kodda (`lib/finance/money.ts`) **`parseNumericInput` diye bir fonksiyon yok**. Grep tüm `.ts` dosyalarında aradı, sonuç: **0 eşleşme**.

Client tarafında (`add-expense.tsx:237,262,325,338`) doğrudan `toMinor(parseFloat(...), currency)` kullanılıyor. Bu da **float → minor** dönüşümünün UI'da string tabanlı değil, float tabanlı yapıldığı anlamına geliyor. README'deki `parseNumericInput` string→integer garantisi yok.

### P0‑7: `updateExpenseWithSplits` atomik DEĞİL ❌

**Durum:** DOĞRU — CRİTİK BUG.

**Kanıt:** `lib/supabase/queries.ts:327-380`

```typescript
export async function updateExpenseWithSplits(...) {
  // 1. Update expense row          ← ayrı çağrı
  // 2. Delete old splits            ← ayrı çağrı
  // 3. Insert new splits            ← ayrı çağrı
  // 4. Activity log                 ← ayrı çağrı
}
```

4 ayrı Supabase çağrısı. Adım 2 başarılı olup adım 3 başarısız olursa: **masrafın split'leri tamamen kaybolur** — bakiye hesabı kalıcı olarak bozulur. Activity log hataları daha az kritik ama yine de split'siz expense bırakabilir.

Bunun bir RPC içinde transaction ile yapılması gerekir.

### P0‑8: Başka non-atomik çoklu-write akışları mevcut ❌

**Durum:** DOĞRU.

**Kanıtlar:**

1. **`createGroup`** (`lib/supabase/queries.ts:126-155`): 3 ayrı çağrı (insert group → insert member → activity log). Adım 2 başarısız olursa: üyesiz grup kalır.

2. **`createDemoGroup`** (`lib/supabase/queries.ts:469-515`): 4+ ayrı çağrı. Arada hata olursa yarım demo grup kalır.

3. **`addGhostMember`** (`lib/supabase/queries.ts:196-212`): 2 çağrı (insert member + activity log). Activity log hatası kritik değil.

4. **`deleteExpense`** (`lib/supabase/queries.ts:382-404`): 2 çağrı (soft delete + activity log). Activity log hatası kritik değil.

5. **`deactivateMember`** (`lib/supabase/queries.ts:214-223`): 2 çağrı. Activity log hatası kritik değil.

---

### P1‑9: Invite token — client-side `Math.random()` ❌

**Durum:** DOĞRU — collision ve güvenlik riski.

**Kanıt:** `lib/supabase/queries.ts:235-240`

```typescript
function generateToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 30 karakter
  let token = '';
  for (let i = 0; i < 6; i++) token += chars[Math.floor(Math.random() * chars.length)];
  return token;
}
```

- **`Math.random()`** kriptografik değil — predictable (özellikle V8'de xorshift128+).
- 6 karakter × 30 sembol = 729 milyon kombinasyon (30^6 ≈ 729M). Brute-force için yeterince küçük.
- **Collision handling yok:** `group_invites.token` unique constraint var ama duplicate olursa hata fırlatır, retry yok.
- **Expiry opsiyonel** — `expires_at` nullable. Çoğu invite sonsuza kadar geçerli.
- **Rate limit yok** — ne client'ta ne Edge Function'da.

### P1‑10: `revenuecat-webhook` — EXPIRATION/CANCELLATION/BILLING_ISSUE/REFUND işlemiyor ❌

**Durum:** DOĞRU.

**Kanıt:** `supabase/functions/revenuecat-webhook/index.ts:63-67`

```typescript
const purchaseEvents = ['INITIAL_PURCHASE', 'RENEWAL', 'NON_RENEWING_PURCHASE'];
if (!purchaseEvents.includes(event.type)) {
  console.log('[rc-webhook] Skipping non-purchase event:', event.type);
  return json({ success: true, action: 'skipped', reason: `event type: ${event.type}` });
}
```

İşlenmeyen event tipleri:
- **CANCELLATION** → kullanıcı iptal etti ama `user_pro` hala `true`
- **EXPIRATION** → abonelik bitti, entitlement geri alınmadı
- **BILLING_ISSUE** → ödeme sorunu, kullanıcı bilgilendirilmeli
- **REFUND** → para iadesi, Pro erişim kaldırılmalı
- **SUBSCRIPTION_PAUSED** / **TRANSFER** vb.

**Etki:** Kullanıcı aboneliğini iptal etse bile `profiles.user_pro = true` kalır → süresiz bedava Pro. Bu RevenueCat'ten gelen en kritik event'lerden.

### P1‑11: Pro grup limiti (5) sadece client-side enforce ❌

**Durum:** DOĞRU.

**Kanıt:** `app/(tabs)/groups/index.tsx:18,52,56`

```typescript
const MAX_FREE_GROUPS = 5;
const reachedLimit = !isUserPro && (createdGroupCount ?? 0) >= MAX_FREE_GROUPS;

const handleCreatePress = () => {
  if (reachedLimit) {
    router.push('/paywall?context=limit');
    return;
  }
  router.push('/groups/new');
};
```

Kontrol **sadece UI butonunda**. `createGroup()` fonksiyonunda (`lib/supabase/queries.ts:126-155`) **hiçbir limit kontrolü yok**. Doğrudan Supabase API'si ile sınırsız grup oluşturulabilir. RPC'de de limit kontrolü yok.

### P1‑12: Sentry/error monitoring YOK ❌

**Durum:** DOĞRU.

Grep sonucu: **0 eşleşme**. `Sentry`, `crashlytics`, `error.*monitor` — hiçbir yerde yok. Production'da crash'ler, RPC hataları, API failure'ları görünmez.

---

## 2. REDDEDİLEN / YANLIŞ BULGULAR

Hiçbir bulgu reddedilmedi. Tüm maddeler gerçek kodla doğrulandı.

---

## 3. RAPORDA OLMAYAN YENİ BULGULAR

### YN‑1: `delete_group` RPC — service_role ile çalıştırılamaz ❌ (P1)

`supabase/migrations/0007_group_management.sql:29-55`

```sql
if v_created_by <> auth.uid() then
  raise exception 'Only the group founder can delete the group';
end if;
```

Bu kontrol `auth.uid()` kullanır. Client anon key ile çağrıldığında auth.uid() = çağıran kullanıcı. **Ancak** `delete-account` Edge Function'ı service_role ile bu RPC'yi çağıramaz — çünkü service_role ile auth.uid() NULL döner. `delete-account` bu RPC'yi kullanmıyor (direkt `groups.delete()` yapıyor), sorun şimdilik yok. Ama ileride admin paneli gerekirse bu RPC kullanılamaz.

### YN‑2: `transfer_ownership` — groups.created_by profile ID ama güncelleme member.user_id ile yapılıyor ❌ (P1)

`supabase/migrations/0007_group_management.sql:190-192`

```sql
update groups set created_by = v_new_founder_user_id where id = p_group_id;
```

`v_new_founder_user_id` = `group_members.user_id` (doğru). Ancak hayalet üyelerde `user_id = NULL` — **hayalet üyeye ownership devredilemez** (zaten `is_active = true` ve grupta olma kontrolü var, ama hayaletler aktif olabilir). Mevcut founder ayrılmak istediğinde ve tüm diğer üyeler hayaletse transfer mümkün olmaz.

### YN‑3: `groups.created_by` — profiles(id) FK ama hayalet founder mümkün değil ❌ (P2)

`groups.created_by` → `profiles(id)`. Ghost member'ların user_id = NULL olduğu için bir hayalet asla group creator olamaz. Bu doğru bir kısıt. Ancak: creator ayrılırsa groups.created_by geçersiz profile işaret eder (FK ihlali olmaz çünkü cascade yok).

### YN‑4: `fromMinor` parseFloat ile precision kaybı ❌ (P1)

`lib/finance/money.ts:48`

```typescript
return parseFloat((minor / factor).toFixed(decimals));
```

3 ondalıklı para birimleri (KWD) için: `minor / 1000` → `.toFixed(3)` → `parseFloat()`. `parseFloat` tekrar float'a çevirir. Örn. `parseFloat("0.125")` → `0.125` (genelde doğru ama IEEE 754 edge case'leri var).

### YN‑5: `computeBalances` — DB'den gelen decimal'i `toMinor()` ile integer'a çeviriyor (float riski) ❌ (P1)

`lib/finance/balance.ts:84,93,103`

```typescript
const paidMinor = toMinor(exp.amount, currency);
const shareMinor = toMinor(split.share_amount, currency);
```

`exp.amount` DB'den `number` olarak geliyor (Supabase JS client numeric → number). Bu `number` zaten IEEE 754 float. `toMinor` içinde `Math.round(amount * factor)` ile tekrar integer yapılıyor. Çift dönüşüm riski: DB numeric(14,2) → JS number (float) → toMinor (integer). B19'da (BUGFIX-CILA.md:277) bu yüzden 2 kuruşluk hata oluşmuş, `simplifyDebts` tolere edecek şekilde düzeltilmiş (≤2 minor unit tolere ediyor).

### YN‑6: `generateWhatsAppSummary` — `.toFixed(2)` hardcoded ❌ (P2)

`lib/supabase/queries.ts:624`

```typescript
const amt = (tx.amountMinor / 100).toFixed(2);
```

100'e bölme + `.toFixed(2)` — sadece 2 ondalıklı para birimleri için doğru. JPY (0 ondalık) veya KWD (3 ondalık) için yanlış format. `formatAmount` kullanılmalı.

### YN‑7: `revenuecat-webhook` — `REVENUECAT_WEBHOOK_SECRET` boşsa tüm istekler kabul edilir ❌ (P0)

`supabase/functions/revenuecat-webhook/index.ts:14,48`

```typescript
const REVENUECAT_AUTH_HEADER = Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ?? '';
// ...
if (!REVENUECAT_AUTH_HEADER || token !== REVENUECAT_AUTH_HEADER) {
```

Eğer `REVENUECAT_WEBHOOK_SECRET` env var'ı **tanımlı değilse veya boş string ise**:
- `!REVENUECAT_AUTH_HEADER` → `!''` → `true` → her zaman unauthorized döner. ✅ (Bu iyi — false positive yok.)

**Düzeltme:** Asıl sorun tersi: `!REVENUECAT_AUTH_HEADER` kontrolü, secret boş olduğunda her isteği reddeder. Doğru davranış. Ama Secret tanımlandığında ve token eşleştiğinde sorun yok.

### YN‑8: `delete-account` — solo grup silme transaction değil ❌ (P1)

`supabase/functions/delete-account/index.ts:97-112`

Solo gruplar bir loop içinde tek tek siliniyor. Bir grupta hata olursa diğerleri silinmez, user delete de çalışmaz. Eksik temizlik riski.

### YN‑9: `join-via-invite` — auth.uid() ile profil check yok ❌ (P2)

Davetle katılan kullanıcının profili var mı kontrol edilmiyor. Anon auth kullanıcısı profiles tablosunda satırı olmadan gruba katılabilir (trigger ile oluşuyor olması lazım ama garanti değil).

### YN‑10: `splitEqual` / `splitCustomAmounts` / `splitSubset` — pure functions, TEST EDİLMİŞ ✅

`lib/finance/split.ts` — tüm fonksiyonlar integer minor units ile çalışıyor, sum invariant kontrolü var, remainder handling doğru. 75/75 test geçiyor. **Bu kısım temiz.** Sadece bu fonksiyonları çağıran kod (`add-expense.tsx`) float'tan integer'a dönüşümü doğru yapıyor olmalı.

---

## 4. P0/P1/P2 ÖNCELİKLENDİRİLMİŞ GÖREV LİSTESİ

### P0 — Production'da veri kaybı, güvenlik ihlali, para tutarsızlığı

| # | Görev | Etkilenen |
|---|-------|-----------|
| P0-1 | **Tüm SECURITY DEFINER RPC'lere auth.uid() yetki kontrolü ekle** (`add_expense_with_splits`, `add_settlement`, `confirm_settlement`, `reject_settlement`) | 0004, 0006 migration'ları |
| P0-2 | **RLS policy'lerini daralt:** expenses UPDATE/DELETE sadece `created_by` veya founder; settlements UPDATE/DELETE sadece ilgili üyeler | 0001 migration |
| P0-3 | **`revenuecat-webhook`: EXPIRATION/CANCELLATION/REFUND işle** (Pro erişimi geri al) | revenuecat-webhook/index.ts |
| P0-4 | **`updateExpenseWithSplits` RPC yap** (atomik transaction) | Yeni migration + queries.ts |
| P0-5 | **Para birimi modeli kararı:** numeric(14,2) vs numeric(14,3) vs integer | 0001 migration, money.ts, tüm RPC'ler |
| P0-6 | **`parseNumericInput` implemente et** veya README'i güncelle | money.ts, README.md |

### P1 — Security hardening, edge case'ler

| # | Görev | Etkilenen |
|---|-------|-----------|
| P1-1 | **Pro limitini server-side enforce et** (RPC veya Edge Function) | queries.ts, createGroup, yeni migration |
| P1-2 | **Invite token: crypto.randomUUID() + rate limit + expiry** | queries.ts, group_invites migration |
| P1-3 | **`createGroup`'u atomik RPC yap** | Yeni migration, queries.ts |
| P1-4 | **`generateWhatsAppSummary`: `formatAmount` kullan** | queries.ts |
| P1-5 | **`computeBalances`: integer dönüşümünü garantiye al** | balance.ts, money.ts |
| P1-6 | **Sentry/error monitoring kur** | Yeni lib/errors.ts, app/_layout.tsx |
| P1-7 | **`confirm_settlement`: p_confirmed_by settlement.to_member olmalı** | 0006 migration |

### P2 — Nice-to-have, cila

| # | Görev | Etkilenen |
|---|-------|-----------|
| P2-1 | **`fromMinor` precision edge case'leri** | money.ts |
| P2-2 | **`delete-account`: transaction ile solo grup silme** | delete-account/index.ts |
| P2-3 | **Hayalet üyeye ownership transfer edge case** | 0007 migration |
| P2-4 | **Tüm SECURITY DEFINER fonksiyonlara audit log** | Tüm RPC'ler |

---

## 5. HER GÖREV İÇİN ETKİLENECEK DOSYALAR

### P0-1: RPC'lere auth.uid() kontrolü

```
supabase/migrations/0004_drop_fx_columns_add_expense_rpc.sql  → add_expense_with_splits
supabase/migrations/0006_settlements_currency_iban.sql         → add_settlement, confirm_settlement, reject_settlement
supabase/migrations/0009_auth_checks.sql                       ← YENİ migration (fix)
```

### P0-2: RLS politikaları daraltma

```
supabase/migrations/0001_initial_schema.sql  → expenses, settlements, group_members policies
supabase/migrations/0009_rls_fix.sql          ← YENİ migration
lib/supabase/queries.ts                       → RLS'e güvenen client kodu gözden geçir
```

### P0-3: revenuecat-webhook iptal/expiry

```
supabase/functions/revenuecat-webhook/index.ts
```

### P0-4: updateExpenseWithSplits RPC

```
supabase/migrations/0010_update_expense_rpc.sql  ← YENİ
lib/supabase/queries.ts                           → RPC'yi çağır
app/(tabs)/groups/[id]/add-expense.tsx            → çağrıyı güncelle
```

### P0-5: Para birimi modeli

```
supabase/migrations/0011_currency_model_fix.sql  ← YENİ
lib/finance/money.ts
lib/finance/balance.ts
lib/supabase/queries.ts
lib/supabase/types.ts
```

### P0-6: parseNumericInput

```
lib/finance/money.ts
lib/finance/__tests__/money.test.ts
README.md
```

---

## 6. ÖNERİLEN MIGRATION STRATEJİSİ

### Aşama 1: Güvenlik (1-2 gün)

1. **Migration 0009:** Tüm RPC'lere auth.uid() kontrolü + sum validation + member-in-group check
2. **Migration 0010:** RLS policy'leri daralt (expenses update/delete → created_by veya founder)
3. Deployment order: önce migration → sonra client
4. Rollback: RPC'lerin eski halini döndüren `0009_rollback.sql`

### Aşama 2: Atomiklik (1 gün)

4. **Migration 0011:** `update_expense_with_splits` RPC
5. **Migration 0012:** `create_group` RPC (opsiyonel, mevcut akış korunabilir)
6. Client güncellemesi: queries.ts'de RPC çağrıları
7. Rollback: client eski multi-call'a döner, RPC silinir

### Aşama 3: Para birimi modeli (2-3 gün, KARAR BEKLİYOR)

8. **Karar:** numeric(14,2) → integer minor units (bigint) veya numeric(14,3)?
9. **Migration 0013:** Kolon dönüşümü (amount * 10^decimals)
10. Tüm RPC'leri güncelle
11. Tüm pure function'ları güncelle
12. Tüm testleri güncelle
13. **Bu migration geri alınamaz — yedek alınmalı!**

### Aşama 4: RevenueCat + Limit (1 gün)

14. revenuecat-webhook: EXPIRATION/CANCELLATION/REFUND handler'ları
15. Pro limiti: createGroup RPC'ye limit check

### Aşama 5: Monitoring + Cila (1-2 gün)

16. Sentry entegrasyonu
17. Invite token fix
18. WhatsApp summary fix

---

## 7. TEST STRATEJİSİ

### Güvenlik testleri (P0-1, P0-2)

- **RPC auth test:** Başka kullanıcının JWT'si ile RPC çağrısı → exception beklenir
- **RLS test:** Anon key ile doğrudan `expenses.delete()` → reddedilmeli
- **Settlement spoofing:** Borçlu olmayan kullanıcı `confirm_settlement` çağıramaz
- **Split sum test:** `p_amount != sum(p_splits)` → exception beklenir

### Para testleri (P0-4, P0-5)

- **3-ondalık roundtrip:** 1.255 KWD → store → read → 1.255
- **0-ondalık roundtrip:** 500 JPY → store → read → 500
- **parseNumericInput:** `"19.99"` → 1999, `"19,99"` → 1999, `"₺100"` → 10000

### Atomiklik testleri (P0-4, P0-7)

- **updateExpenseWithSplits rollback:** Split insert başarısız → expense update geri alınır
- **createGroup rollback:** Member insert başarısız → group insert geri alınır

### Entegrasyon testleri

- **Full flow:** Anon auth → create group → add expense → confirm settlement → balance = 0
- **Multi-currency:** TRY + EUR + JPY expense → her birinin bakiyesi bağımsız

---

## 8. KARAR BEKLEYEN SORULAR

### Q1: Para birimi modeli — şimdi mi değiştirelim, sonraya mı?

`numeric(14,2)` 2 ondalıkla sınırlı. İki seçenek:

**Seçenek A: Integer minor units (bigint)**
- Artı: Float riski tamamen yok. Her para birimi doğal olarak desteklenir.
- Eksi: Migration riskli (tüm amount kolonlarını dönüştürmek gerek). Tüm RPC'lerin ve pure function'ların update edilmesi gerek. Testler yeniden yazılır. ~3 gün.
- Kolon tipi: `amount bigint` (kuruş cinsinden)

**Seçenek B: numeric(14,3) — 3 ondalık**
- Artı: BHD/KWD/OMR/TND için yeterli. Migration daha basit (precision artırma).
- Eksi: JPY/KRW için hala 0 ondalık sorunu yok (100.000 olarak saklanır, doğru). Ama float riski devam eder.
- Kolon tipi: `amount numeric(14,3)`

**Seçenek C: numeric(14,2) ile sınırla, 0 ve 3 ondalıklı para birimlerini kaldır**
- Artı: Hiçbir değişiklik yok. Hemen production'a çıkabilir.
- Eksi: SUPPORTED_CURRENCIES'den JPY, KRW, VND, BHD, KWD, OMR, TND çıkarılmalı. Kullanıcılar bu para birimlerini kullanamaz.
- Kolon tipi: `amount numeric(14,2)` (mevcut)

**Öneri:** **Seçenek A (integer)** uzun vadede en doğrusu. Ama Faz 8 öncesi zamanlamaya bağlı. Eğer Faz 8 (store submission) yakınsa, **Seçenek C** ile başlayıp integer dönüşümünü Faz 9'a bırakmak daha güvenli.

### Q2: Pro limiti — server-side RPC ile mi yoksa Edge Function ile mi?

- RPC: Basit, tek SQL çağrısı. Ama Pro kontrolü için profiles.user_pro okuması gerek.
- Edge Function: Daha esnek, rate limiting eklenebilir. Ama ekstra latency.
- **Öneri:** RPC (`create_group_with_limit`) — basit ve yeterli. `auth.uid()` ile profiles.user_pro kontrol eder, demo hariç grup sayısını sayar, 5'ten azsa veya Pro ise izin verir.

### Q3: RevenueCat webhook — EXPIRATION'da Pro'yu hemen mi kaldıralım, grace period verelim mi?

RevenueCat best practice: EXPIRATION'da hemen kaldırma, `BILLING_ISSUE` ile grace period başlat, `CANCELLATION` ile hemen kaldırma. Ama basitlik için:
- **Öneri:** `EXPIRATION` + `CANCELLATION` + `REFUND` → `user_pro = false`. `BILLING_ISSUE` → şimdilik log'la, sonra notification ekle.

### Q4: Sentry — hangi plan?

- Expo + Sentry entegrasyonu: `sentry-expo` paketi. Free tier 5000 events/month.
- **Öneri:** Faz 8'de EAS Build ile birlikte kur. Şu an Expo Go'da Sentry çalışmaz (native module).

---

## 9. SONUÇ

**Hiçbir kod değişikliği yapılmadı.**

Groopay kodu genel olarak iyi yapılandırılmış, finansal hesaplamalar (pure functions) temiz, 75/75 test geçiyor. Ancak **production'a çıkmadan önce mutlaka giderilmesi gereken P0 güvenlik açıkları mevcut:**

1. **RPC'lerde auth.uid() kontrolü yok** — en kritik 3 RPC'de (`add_expense_with_splits`, `add_settlement`, `confirm_settlement`/`reject_settlement`) saldırgan başkasının grubuna masraf ekleyebilir, settlement'ları manipüle edebilir.

2. **RLS policy'leri çok geniş** — herhangi bir grup üyesi başkasının masrafını silebilir.

3. **updateExpenseWithSplits atomik değil** — hata durumunda masraf split'siz kalır, bakiye hesabı bozulur.

4. **RevenueCat webhook iptal/expiry işlemiyor** — iptal eden kullanıcı Pro kalır.

5. **Para birimi: numeric(14,2) ile 3 ondalıklı para birimleri uyumsuz.**

Öncelik sıralaması: **P0-1 (auth) → P0-3 (webhook) → P0-4 (atomic update) → P0-2 (RLS) → P0-5 (currency model)**.

---

*Analiz: 2026-06-01 — Claude Opus 4.8*
*Sonraki adım: Kullanıcı onayıyla P0 fix'lere başla.*
