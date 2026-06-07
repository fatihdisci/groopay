# Groopay — Project Rules

> Kapsam kararları için: [`docs/groopay-scope.md`](docs/groopay-scope.md)
> Teknik build planı için: [`docs/groopay-build-spec.md`](docs/groopay-build-spec.md)
> Oturum özeti + son durum: [`SESSION-OZET.md`](SESSION-OZET.md)
> Son faz planı: [`FAZ8-PLAN.md`](FAZ8-PLAN.md)
> Bugfix & cila kaydı: [`BUGFIX-CILA.md`](BUGFIX-CILA.md)

---

## Bugfix & Geliştirme Kaydı (ZORUNLU)

- **Her hata düzeltmesi, regresyon giderme, tasarım değişikliği veya yeni özellik `BUGFIX-CILA.md` dosyasına kaydedilir.**
- Format: `### ✅ BXX: Başlık` — sorun, yapılan, değişen dosyalar, nasıl test edileceği, kontrol tablosu.
- Numaralandırma sıralıdır (B1, B2, …). Son numaradan devam et.
- Doğru sıradaki B numarası her zaman `BUGFIX-CILA.md` içindeki son B kaydından bulunur; başka dosyadaki sayaç ipucu tek başına kaynak değildir.
- Her madde sonrası `*Son güncelleme: TARİH — BXX eklendi*` satırı güncellenir.
- Commit mesajlarında B numarası referans verilir: `fix: B47-B53 add-expense regresyon düzeltmeleri`.

---

## Language
- UI: Turkish (via i18next, NEVER hardcoded strings)
- Code: English (identifiers, comments, docs)
- Default locale: `tr`, fallback: `tr`

## TypeScript
- Strict mode enabled; `any` is forbidden.
- Prefer explicit return types on exported functions.

## Money (KRİTİK)
- NEVER use float for calculation.
- Always compute in integer minor units (kuruş).
- Store as `numeric` in PostgreSQL.
- **User input parsing:** Use `parseMoneyInputToMinor(input: string, currency: string): number` from `lib/finance/money.ts` for all amount entry. NO `parseFloat()` — avoids IEEE 754 precision issues. Returns integer minor units directly from string.
- Rounding: remaining kuruş goes to payer.
- **Display:** Use `formatAmount(amount, currency)` from `lib/finance/money.ts` for all amount rendering. NEVER use `toFixed()` + raw currency code. Returns tr-TR formatted string with symbol (₺591,63, €50,00, $100,00).
- ⚠️ **numeric(14,2) constraint:** Currently only 2-decimal currencies supported (TRY, USD, EUR, GBP, etc. — 18 total). 0-decimal (JPY, KRW, VND) and 3-decimal (BHD, KWD, OMR, TND) are hidden from UI but `getDecimals` still works internally. Will be re-enabled after integer minor unit migration (Faz 9).

## Security — Server-Side Authorization (KALICI KARAR, Haziran 2026)

- **All sensitive writes** (expense add/edit/delete, settlement mark/confirm/reject, member add/remove, group create/delete, invite create) MUST go through **SECURITY DEFINER RPCs** with `auth.uid()` authorization checks.
- Direct table writes from the client are restricted by RLS (narrow policies: owner or founder). RPCs bypass RLS — so the auth check MUST be inside the RPC.
- New features: follow the same pattern. Create a SECURITY DEFINER RPC with `set search_path = public` + `auth.uid()` ownership verification. Do NOT rely on client-side checks alone (they are trivially bypassed via anon key).
- RLS: SELECT stays broad (`is_member_of`), INSERT/UPDATE/DELETE is narrow (self or founder) or blocked entirely (RPC-only).
- RevenueCat webhook: handles GRANT (purchase/renewal/uncancel) and REVOKE (expiration/cancel/refund) events. `user_pro` lives in DB, not client.

## FX (Kur)
- Expenses are stored in their ORIGINAL currency (amount + currency). NEVER convert and store in base.
- Balance/debt is always computed PER CURRENCY. Different currencies are shown SEPARATELY.
- Conversion is DISPLAY-ONLY: user toggles "show TRY equivalent" → live rate fetched from Frankfurter → shown as "≈ X TRY (today's rate, informational)". This value is NEVER saved.
- Same currency → no conversion needed.
- API failure → silently skip conversion, show only original amount. Never block the user.
- Group `base_currency` is now the DEFAULT DISPLAY CURRENCY only (not a calculation basis).

## Financial Logic
- All calculations in `lib/finance/` as PURE functions.
- EVERY function must have unit tests.
- All split calculations are done in a SINGLE currency (the expense's own currency). Cross-currency addition does NOT exist.
- Balance is DERIVED (never stored), computed per-currency from expenses + confirmed settlements.
- Pending settlements do NOT affect balance.
- `base_currency` on groups is the DEFAULT DISPLAY CURRENCY — not a calculation basis.

## Data Model (Phase 2+)
- **Hybrid member model**: everything references `group_members.id`, NOT `user_id`.
- Ghost members have `user_id = NULL`; when they claim, `user_id` is SET (no new row → history preserved).
- Soft delete for expenses (`deleted_at`).
- Demo groups excluded from limits/stats (`is_demo` filter).
- RLS: use `SECURITY DEFINER` function to avoid recursion trap.

## Auth (Phase 8)
- Guest (anonymous) sign-in is active in production alongside Google and Apple sign-in.
- Apple Sign In uses `expo-apple-authentication` + `signInWithIdToken` natively on iOS; Android keeps the Supabase web OAuth flow.
- Guests keep full access to core group, expense, balance, and invite flows.
- Before a Pro purchase, guests must link Google or Apple. Web OAuth and native Apple ID-token linking both use `linkIdentity` to upgrade the same `auth.users` row, so the user ID and existing data are preserved.
- If identity linking fails, do not fall back to a new OAuth user and do not start the purchase.
- No password storage.
- Apple requires "Sign in with Apple" when third-party sign-in is offered.
- Account deletion uses the user-JWT-scoped `delete_user_data` SECURITY DEFINER RPC for atomic database cleanup, then the `delete-account` Edge Function uses service role only for `auth.admin.deleteUser()`.

## IBAN
- IBAN is NEVER stored in the database (no exceptions).
- IBAN sharing uses WhatsApp deep links.
- Debtor taps the WhatsApp/IBAN action → app generates a localized WhatsApp message → opens WhatsApp; if unavailable, the message is copied to clipboard.
- Do NOT re-add Supabase Realtime broadcast, `iban_requests` queries, or `iban_requests` listeners for IBAN sharing.

## Realtime
- Group detail uses `useRealtime(groupId)` for per-group expenses, splits, members, and activity changes.
- Global tabs use `useRealtimeAllGroups(memberGroupIds)` for panel, groups list, and activity updates.
- `memberGroupIds` passed to `useRealtimeAllGroups` MUST be memoized with `useMemo`; do not pass a fresh array each render.
- Realtime-backed React Query hooks should use `staleTime: 0`.
- Global Realtime listens to `expenses`, `group_members`, `activity_log`, and `settlements`.
- Do NOT add an `iban_requests` Realtime listener; IBAN moved to WhatsApp.

## Monetization (Phase 7+) — Simplified June 2026
- RevenueCat for IAP (receipt validation + entitlement).
- **Only User Pro (monthly) is active.** Group Pro UI removed, code kept for future.
- `hasProAccess()` checks ONLY `profile.user_pro`.
- Paywall: 3 working features (Dashboard, unlimited groups, category analytics). No vaporware.
- DEV-only Pro toggle button in account screen (`__DEV__` guard).

## Icons
- Use `@expo/vector-icons` (Ionicons, SVG-based).
- Do NOT use emojis for UI icons.

## Accessibility
- Sufficient color contrast (WCAG AA minimum).
- Touch targets ≥ 44px (`minTouchTarget` in theme).
- Respect `prefers-reduced-motion` for animations.
- Critical touchables must have `accessibilityLabel` from i18n (`t()`), never hardcoded strings.
- Use `accessibilityRole="button"` for buttons and `accessibilityRole="radio"` plus `accessibilityState.selected` for selected option chips.
- Preserve existing `hitSlop` and touch target sizing when adding accessibility props.

## Environment
- Only `EXPO_PUBLIC_` prefixed env vars are usable.
- `.env` is NEVER committed (in `.gitignore`).
- `.env.example` provides the key names without values.

## Native Modules
- BEFORE installing any native module (RevenueCat, native auth, push notifications, etc.):
  ASK ME FIRST — these require dev builds (not Expo Go) and are OUT OF SCOPE for Phase 0.

## Phase Discipline
- Do NOT start the next phase until the current phase's acceptance criteria pass.
- Each phase's acceptance criteria are defined in [`docs/groopay-build-spec.md`](docs/groopay-build-spec.md) Section 8.

## Project Structure
```
groopay/
  app/                      # Expo Router screens
  lib/
    supabase/               # client, queries, types
    finance/                # money, split, fx, balance, simplify (PURE + tested)
    i18n/
    revenuecat/             # Phase 7
  components/               # shared UI
  hooks/                    # shared hooks
  locales/ tr.json en.json
  constants/ theme.ts
  supabase/
    migrations/             # SQL
    functions/              # Edge Functions
  docs/                     # scope + build spec
```

## Acceptance Criteria (Phase 0)
- `npx expo start` starts without errors.
- App opens in Expo Go with 4 bottom tabs (Gruplar / Panel / Aktivite / Hesap).
- Tab titles come from i18n (Turkish by default).
- `lib/supabase/client.ts` imports without crash (env vars read).
- Zero TypeScript errors (`npx tsc --noEmit`).

## UI/UX Decisions (June 2026)

### Tab Bar
- 4 tabs: Panel · Gruplar · Aktivite · Hesap
- Active: filled icon + primary color + pill indicator + scale animation (Reanimated)
- Inactive: outline icon + textTertiary
- Shadow: purple-tinted, upwards
- Height: 88 (iOS), safe area padding included
- `TabBarButton` component handles scale animation

### Header Architecture (KRİTİK — DO NOT BREAK)

**Genel prensip:** Sayfalar iki tipte header kullanır:
- **Tab header** (Tabs.Screen options): Panel, Aktivite, Hesap sekmelerinde. `headerShadowVisible: true`, `headerStyle.backgroundColor: Colors.background`.
- **Custom gradient header** (LinearGradient): Grup detayı ve düzenleme sayfalarında. Stack header gizlenir, gradient içine gömülü nav butonları kullanılır.

**Groups sekmesi (grup listesi):**
- Tab header "Gruplar" başlığını gösterir (`headerShown` default `true`, KALDIRILMAZ).
- `groups/index.tsx`: Stack header `useLayoutEffect` ile gizlenir (`headerShown: false`). Tab header görünür kalır.

**Grup detay/düzenleme ([id]/index, [id]/edit) — custom gradient header:**
- Stack header `useLayoutEffect` ile gizlenir (`headerShown: false`).
- Gradient header (`LinearGradient #6366F1 → #8B5CF6`) ekranın en üstünde başlar.
- **Gradient style:** `borderRadius: Radius.xl` (tüm köşeler yuvarlak), `paddingBottom: Spacing.xl`, `paddingHorizontal: Spacing.lg`. `paddingTop` YOK (static'te kaldırıldı, içeride headerTopBar handle eder).
- **Header button bar:** `headerTopBar` — `paddingTop: 4` (inline), `marginBottom: 8`. Butonlar status bar'ın hemen altında.
- **Content container:** `paddingTop: 12, paddingHorizontal: spacing.md, paddingBottom: spacing.xxl * 2`.
- Butonlar: geri (sol), düzenle+tips (sağ). Founder değilse düzenleme görünmez.
- **DO NOT** move group routes to root Stack — this hides the bottom tab bar.
- **DO NOT** create nested `app/groups/[id]/_layout.tsx` — causes duplicate route conflicts.
- **DO NOT** add `paddingTop` to `headerGradient` static style — butonlar aşağı kayar.
- **DO NOT** add `insets.top` to `headerTopBar` — React Navigation safe area'yı zaten handle ediyor, çift sayım yapar.
- **DO NOT** change `headerTopBar.paddingTop` (4) or `content.paddingTop` (12) without testing on device — butonların status bar mesafesi bu iki değerin toplamına bağlı.

### Dashboard
- 4th tab "Panel" (stats-chart icon)
- Free: hero balance + stats + category breakdown (always visible)
- Pro: SimpleBarChart (View-based, no SVG dep), insight cards
- Free locked sections: blur placeholder + "Pro'ya Geç" CTA

### Paywall
- Modern fintech: open feature rows, soft shadow price card
- Gradient hero header uses `expo-linear-gradient`, `Colors.gradientStart` → `Colors.gradientEnd`, with the close button on top of the hero.
- Only User Pro, no Group Pro card
- X close button top-right (no title bar)
- Live price via RevenueCat offering
- Price loading must have a 5-second timeout. While loading show spinner; after timeout show `paywall.priceError`; CTA disabled only while still waiting for price.

### Add Expense
- Wise-style numpad (View-based, 48px bold amount)
- Currency pill selector, expandable details
- When numpad opens, system keyboard closes and details panel collapses to avoid overlapping input modes.
- `splitEqual()` from `lib/finance/split.ts` — NEVER float math
- Split type selector (equal/custom/subset)
- Validation: amount > 0 + description + paidBy required

### Balance Screen
- `SimplifiedBalanceList` keeps the amount column aligned on the right.
- Debtor action buttons live under the amount in `simplifiedActionRow`, not beside the amount.
- Action buttons keep labels visible and compact; preserve existing touch targets and accessibility labels.

### Group Management
- Group edit: name, description, avatar color (8), emoji (16)
- Live header preview + "DÜZENLEME MODU" label
- Delete group: RPC `delete_group()`, hard delete + cascade
- Remove member / leave group: RPC `remove_member()`
- Transfer ownership: RPC `transfer_ownership()`
- Account deletion: Edge Function `delete-account` (Apple required)
- Data export: JSON via Share API

### Tips/Help Popups
- `TipsButton` + `TipsModal`: contextual "?" help
- Pages: group detail, add expense, members
- i18n: `tips.*` namespace

### Design System Consistency
- Hero gradient: `#6366F1 → #8B5CF6` (all screens)
- Header border: Stack `headerStyle.backgroundColor: Colors.background`
- Font: Plus Jakarta Sans (display), Inter (body)
- Shadows: purple-tinted (`#4F46E5`)
- No opacity string concatenation — use `Colors.primaryGhost` etc.

### Join / Create Flows (June 2026)
- **Yeni Grup** ve **Gruba Katıl** butonları groups sayfasında bottom bar'da
- Butonlara basınca **Modal bottom sheet** açılır (sayfa navigasyonu değil)
- Sheet: `Colors.surface`, `borderTopLeftRadius/borderTopRightRadius: 24`, drag handle (4×40px), `Shadows.lg`
- `Modal transparent animationType="slide"` + `KeyboardAvoidingView` + `TouchableWithoutFeedback` backdrop
- Backdrop'a basınca kapanır, Vazgeç butonu da kapatır
- Aynı pattern başka bottom sheet'ler için de kullanılabilir

### Inline Panel Pattern (Members screen)
- Üye yönetimi: Hayalet Ekle / Davet Et butonları inline panel açar
- `activePanel: 'ghost' | 'invite' | null` — tek panel açık (toggle)
- Panel kart stili: `panelCard` — `Colors.surface`, `borderWidth: 1.5`, `borderColor: Colors.primary`, `Radius.xl`, `Shadows.sm`
- Panel kartları FlatList `ListHeaderComponent` içinde, butonların hemen altında

### Default Tab
- Uygulama açılışta **Panel (dashboard)** sekmesine gider: `app/index.tsx` → `<Redirect href="/(tabs)/dashboard" />`
- Gruplar sekmesine geçişte `_layout.tsx`'te `Stack.Screen name="index"` TANIMLI OLMALI (B84)

### Migration 0014
- `delete_group` RPC: child tabloları sırayla siler (FK cascade hatasını önler)
- Sıra: expense_splits → expenses → settlements → activity_log → iban_requests → group_invites → group_members → groups

### Current Numbering
- Latest bugfix log entry: check `BUGFIX-CILA.md` before adding any B record.
- Latest migration applied: `0014_fix_delete_group_cascade.sql`.
- Next migration number: `0015`.
