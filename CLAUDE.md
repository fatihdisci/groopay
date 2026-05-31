# Groopay — Project Rules

> Kapsam kararları için: [`docs/groopay-scope.md`](docs/groopay-scope.md)
> Teknik build planı için: [`docs/groopay-build-spec.md`](docs/groopay-build-spec.md)
> Oturum özeti + son durum: [`SESSION-OZET.md`](SESSION-OZET.md)
> Son faz planı: [`FAZ6-PLAN.md`](FAZ6-PLAN.md)

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

## Monetization (Phase 7+)
- RevenueCat for IAP (receipt validation + entitlement).
- Group Pro entitlement stored server-side on `group_id` (NOT client-side).
- Group Pro → permanent unlock for that group; any real member can purchase.
- User Pro → all groups + personal analytics.

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
- App opens in Expo Go with 3 bottom tabs (Gruplar / Aktivite / Hesap).
- Tab titles come from i18n (Turkish by default).
- `lib/supabase/client.ts` imports without crash (env vars read).
- Zero TypeScript errors (`npx tsc --noEmit`).
