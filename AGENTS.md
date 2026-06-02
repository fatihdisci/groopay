# Groopay — Agent Rules

> Stack: React Native + Expo SDK 54, Expo Router, TypeScript (strict), Supabase, RevenueCat, i18next, React Query, Zustand  
> Platform: iOS + Android (currently Expo Go; EAS build pending)  
> Docs: CLAUDE.md (full rules) · SESSION-OZET.md (current state) · BUGFIX-CILA.md (fix log)

---

## BEFORE WRITING ANY CODE

1. Run `npx tsc --noEmit` to see current error state.
2. Read the relevant file(s) you will edit.
3. Read `SESSION-OZET.md` if the task touches architecture, routing, or DB.
4. After every change, run `npx tsc --noEmit` — it must stay clean.

---

## MANDATORY RULES (never break these)

### Language
- All UI strings via `i18next` — NEVER hardcode Turkish or English in JSX.
- Add keys to both `locales/tr.json` and `locales/en.json`.
- Code identifiers and comments: English.

### TypeScript
- `strict: true` — `any` is forbidden. Use `unknown` + type guards.
- Explicit return types on all exported functions.

### Money — CRITICAL
- **NEVER use float for money math.** Not `parseFloat`, not `toFixed`, not `/100`.
- All amounts: integer minor units (kuruş). `parseMoneyInputToMinor(input, currency)` from `lib/finance/money.ts` for input parsing.
- Display: `formatAmount(amount, currency)` from `lib/finance/money.ts` — returns `₺591,63` style.
- Postgres: `numeric(14,2)`. Only 2-decimal currencies supported now (TRY, USD, EUR, GBP…). JPY/KWD etc. are hidden — don't re-enable.

### Security
- Sensitive writes (expense, settlement, member, group, invite) → **SECURITY DEFINER RPC** with `auth.uid()` check inside the RPC.
- Never rely on client-side auth checks alone.
- IBAN: **never stored in DB**. IBAN sharing uses WhatsApp deep links with clipboard fallback; do not re-add Realtime broadcast or `iban_requests` listeners.

### Icons
- `Ionicons` from `@expo/vector-icons` only. No SVG icons, no emoji icons.

### Touch targets
- All interactive elements: `minHeight: 44`, `minWidth: 44`.

---

## DESIGN SYSTEM (constants/theme.ts)

```
Background:  #F7F6FF
Primary:     #4F46E5   Gradient: #4F46E5 → #7C3AED
Hero gradient (screens): #6366F1 → #8B5CF6
Debt:        #F43F5E (rose)
Credit:      #10B981 (emerald)
Font display: Plus Jakarta Sans  (fontDisplayBold / fontDisplayMedium)
Font body:    Inter              (fontBody / fontBodyBold / fontBodyMedium)
             NEVER use Poppins
Card radius: 16    Button radius: 12–14    Pill: Radius.full
Shadows: purple-tinted
```

Amount format: tr-TR locale, symbol (₺/€/$), thousands separator `.`, decimal `,`  
Direction: color + word ("borçlusun" / "alacaklısın"). NO +/- signs.

---

## HEADER ARCHITECTURE — DO NOT BREAK

Two header types:
- **Tab header**: Panel, Aktivite, Hesap tabs. Default Tabs.Screen options.
- **Custom gradient header**: Group detail + edit. Stack header hidden via `useLayoutEffect`, LinearGradient replaces it.

**Groups tab:**
- `app/(tabs)/_layout.tsx` — `Tabs.Screen name="groups"` keeps default `headerShown` (DO NOT set false here).
- `app/(tabs)/groups/index.tsx` — hides its own Stack header with `useLayoutEffect`.
- `app/(tabs)/groups/_layout.tsx` — Stack manages: index → [id] → add-expense → members → edit.

**NEVER:**
- Move group routes to root Stack (hides bottom tab bar).
- Create `app/groups/[id]/_layout.tsx` (duplicate route conflict).
- Add `paddingTop` to static `headerGradient` style.
- Add `insets.top` to `headerTopBar` (React Navigation already handles safe area).

---

## DATA MODEL

- Member references: always `group_members.id`, never `user_id`.
- Ghost member: `user_id = NULL`. Claim sets `user_id` on same row (history preserved).
- Balance: derived (never stored) from `expenses + splits + confirmed settlements`, per currency.
- Pending settlements: do NOT affect balance.
- Demo groups: excluded from limits/stats via `is_demo` filter.

---

## REALTIME

- Group detail uses `useRealtime(groupId)` for per-group expenses, splits, members, and activity changes.
- Global tabs use `useRealtimeAllGroups(memberGroupIds)` for panel, groups list, and activity updates.
- `memberGroupIds` passed to `useRealtimeAllGroups` must be memoized with `useMemo`; do not pass a fresh array each render.
- Realtime-backed React Query hooks should use `staleTime: 0` so invalidations refetch immediately.
- Global Realtime listens to `expenses`, `group_members`, `activity_log`, and `settlements`.
- Do not add an `iban_requests` Realtime listener; IBAN moved to the WhatsApp flow.

---

## UI PATTERNS

### Bottom Sheet (Modal)
```
Modal transparent animationType="slide"
KeyboardAvoidingView (behavior: padding iOS / height Android)
TouchableWithoutFeedback backdrop → closes on tap
Sheet: Colors.surface, borderTopLeftRadius/borderTopRightRadius: 24
Drag handle: 4×40px, Colors.border, borderRadius 2, alignSelf center
Shadows.lg
```

### Inline Panel (Members screen)
```
activePanel: 'ghost' | 'invite' | null
panelCard: Colors.surface, borderWidth 1.5, borderColor Colors.primary, Radius.xl, Shadows.sm
Inside FlatList ListHeaderComponent
```

### Empty States
Always render an empty state — never show a blank screen.

### textTransform
Never use `textTransform: 'uppercase'` — use `.toLocaleUpperCase('tr-TR')`.

---

## CURRENT STATE (June 2026)

- Phase 0–7 complete ✅
- B1–B86 bugfixes done
- `npx tsc --noEmit` clean, 87 tests passing
- App works in Expo Go
- Phase 8 pending: Google/Apple OAuth, EAS build, RevenueCat sandbox, icons/splash, TestFlight

**Migrations applied:** 0001–0014  
**Next migration number:** 0015

---

## WORKFLOW

```bash
# After every code change:
npx tsc --noEmit

# Run tests:
npx jest --testPathPattern="lib/finance"

# Start app:
npx expo start
```

**DO NOT** run `npx expo install` or add native modules without explicit instruction — native modules require EAS build, not Expo Go.

**DO NOT** commit `.env` — it is gitignored.

---

## BUGFIX LOG

Every fix, feature, or design change must be appended to `BUGFIX-CILA.md`:
```
### ✅ BXX: Title
**Sorun:** ...
**Yapılan:** ...
**Değişen dosyalar:** ...
**Test:** ...
*Son güncelleme: YYYY-MM-DD — BXX eklendi*
```
Next B number: always check **BUGFIX-CILA.md** and continue from the latest B entry.  
Commit message format: `fix: BXX short description` or `feat: BXX short description`
