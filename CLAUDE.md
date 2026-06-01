# Groopay — Project Rules

> Kapsam kararları için: [`docs/groopay-scope.md`](docs/groopay-scope.md)
> Teknik build planı için: [`docs/groopay-build-spec.md`](docs/groopay-build-spec.md)
> Oturum özeti + son durum: [`SESSION-OZET.md`](SESSION-OZET.md)
> Son faz planı: [`FAZ6-PLAN.md`](FAZ6-PLAN.md)
> Bugfix & cila kaydı: [`BUGFIX-CILA.md`](BUGFIX-CILA.md)

---

## Bugfix & Geliştirme Kaydı (ZORUNLU)

- **Her hata düzeltmesi, regresyon giderme, tasarım değişikliği veya yeni özellik `BUGFIX-CILA.md` dosyasına kaydedilir.**
- Format: `### ✅ BXX: Başlık` — sorun, yapılan, değişen dosyalar, nasıl test edileceği, kontrol tablosu.
- Numaralandırma sıralıdır (B1, B2, …). Son numaradan devam et.
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
- Rounding: remaining kuruş goes to payer.

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

## Auth (Phase 1+)
- Google + Apple Sign-In only (Supabase OAuth).
- No password storage.
- Apple requires "Sign in with Apple" when third-party sign-in is offered.

## IBAN
- IBAN is NEVER stored in the database (no exceptions).
- "Request IBAN" flow: debtor requests → creditor receives notification → enters IBAN momentarily → shared → NOT saved.

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
    finance/                # split, fx, balance, simplify (PURE + tested)
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
- **Header button bar:** `headerTopBar` — `paddingTop: 2` (inline), `marginBottom: 8`. Butonlar status bar'ın hemen altında.
- **Content container:** `paddingTop: 8, paddingHorizontal: spacing.md, paddingBottom: spacing.xxl * 2`.
- Butonlar: geri (sol), düzenle+tips (sağ). Founder değilse düzenleme görünmez.
- **DO NOT** move group routes to root Stack — this hides the bottom tab bar.
- **DO NOT** create nested `app/groups/[id]/_layout.tsx` — causes duplicate route conflicts.
- **DO NOT** add `paddingTop` to `headerGradient` static style — butonlar aşağı kayar.
- **DO NOT** add `insets.top` to `headerTopBar` — React Navigation safe area'yı zaten handle ediyor, çift sayım yapar.

### Dashboard
- 4th tab "Panel" (stats-chart icon)
- Free: hero balance + stats + category breakdown (always visible)
- Pro: SimpleBarChart (View-based, no SVG dep), insight cards
- Free locked sections: blur placeholder + "Pro'ya Geç" CTA

### Paywall
- Modern fintech: open feature rows, soft shadow price card
- Only User Pro, no Group Pro card
- X close button top-right (no title bar)
- Live price via RevenueCat offering

### Add Expense
- Wise-style numpad (View-based, 48px bold amount)
- Currency pill selector, expandable details
- `splitEqual()` from `lib/finance/split.ts` — NEVER float math
- Split type selector (equal/custom/subset)
- Validation: amount > 0 + description + paidBy required

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
