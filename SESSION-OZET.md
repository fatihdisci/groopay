# Groopay — Oturum Özeti

> Son oturum: 2026-06-02
> Durum: Faz 0-7 tamam ✅, P0 güvenlik turu tamam (B65-B72) ✅, Cila turu tamam (B73-B86) ✅

---

## Şu an neredeyiz?

Faz 0-7 tamam. 16 tur bugfix (B1-B86) tamamlandı. **P0 güvenlik turu (B65-B72):** tüm RPC'ler auth.uid() korumalı, RLS daraltıldı, atomik mutation'lar, RevenueCat revoke handling. **Cila turu (B73-B86):** Dashboard Tüm İşlemler, aktivite arama, hesap reorganizasyonu, üye yönetimi yenileme, yeni grup/gruba katıl Modal bottom sheet, panel varsayılan sekme, profil adı cache fix. Uygulama Expo Go'da çalışır durumda.

---

## Bugfix Turları (B1-B64)

Detaylar için: [`BUGFIX-CILA.md`](BUGFIX-CILA.md)

| Tur | Kapsam | B#'lar |
|---|---|---|
| 1 | Aktivite metinleri, bakiyeler, TR karakter, toast, avatar rengi, i18n | B1-B6 |
| 2 | FAB butonları, üye sayısı, kurucu yetkileri, genişleyebilir kart | B7-B12 |
| 3 | Aktivite settlement metni, FAB metinleri, buton boyutları, split gizleme | B13-B17 |
| 4 | simplifyDebts kuruş crash, Pro sadeleştirme (tek User Pro) | B18-B24 |
| 5 | Grup yönetimi (edit, delete, emoji avatar, transfer, remove member) | B25-B31 |
| 6 | Route düzeltme, hooks, edit sayfası header | B32-B35 |
| 7 | Alt bar tasarımı, animasyonlar, header alt çizgisi | B36 |
| 8 | Hesap silme, veri dışa aktarma, delete-account Edge Function | B37 |
| 9 | Dashboard 4. sekme, ücretsiz/Pro ayrımı | B38-B39 |
| 10 | Tips/yardım popupları, Wise numpad, Pro dashboard analitiği | B40-B44 |
| 11 | Header mimarisi (B45-B46), add-expense regresyon (B47-B53) | B45-B53 |
| 12 | Dashboard para birimi karışması (B54-B56) | B54-B56 |
| 13 | Dashboard para birimi seçici + profil varsayılanı | B57 |
| 14 | Dashboard detaylı analiz, kurucu ayrılma, TipsButton, header butonları | B58-B62 |
| 15 | Para formatı tutarsızlığı, masraf kartı layout | B63-B64 |
| 16 | **P0 güvenlik:** RPC auth, RLS daraltma, RevenueCat revoke, atomik mutation, para birimi, Pro limiti, invite token | B65-B72 |
| 17 | Dashboard Tüm İşlemler, ay filtresi, aktivite fix, FK cascade | B73-B79 |
| 18 | Hesap reorganizasyonu, panel varsayılan sekme, aktivite arama | B80-B82 |
| 19 | Üye yönetimi yenileme, groups routing fix | B83-B84 |
| 20 | Yeni Grup + Gruba Katıl ekranları, inline → Modal bottom sheet | B85-B86 |

---

## Faz Faz Durum

| Faz | Ne | Durum |
|---|---|---|
| 0 | Proje iskeleti, Expo SDK 54, i18n, theme | ✅ |
| 1A | Misafir auth (Supabase), profil, onboarding, demo grup | ✅ |
| 2 | Veritabanı şeması (8 tablo), RLS, migration | ✅ |
| 3 | Grup CRUD, hayalet üye, davet kodu, katılma + claim | ✅ |
| 4 | Masraf CRUD + bölüşme + çoklu para birimi | ✅ |
| 5 | Bakiye + sadeleştirme + aktivite + Realtime | ✅ |
| 6 | Netleşme + IBAN + push altyapısı + WhatsApp | ✅ |
| 7 | Monetizasyon (RevenueCat + paywall + Pro kapıları) | ✅ |
| 8 | Store-hazırlık + cila + OAuth + dev build | ⏳ |

---

## Önemli Mimari Kararlar (güncel — Haziran 2026)

1. **Auth:** `lib/auth/AuthContext.tsx` — Google OAuth, production misafir girişi ve Apple girişi birlikte aktif. Apple iOS'ta `expo-apple-authentication` + `signInWithIdToken` ile native modal kullanır; Android'de web OAuth devam eder. Misafir hesap Pro satın almadan önce web OAuth veya native Apple ID token ile `linkIdentity` üzerinden aynı user ID üzerinde yükseltilir; mevcut grup ve masraf verileri korunur.
2. **Hayalet üye:** `group_members.user_id = NULL`. Claim → aynı satıra `user_id` yazılır.
3. **Para:** ASLA float, integer kuruş + Postgres numeric.
4. **FX:** Masraf orijinal para biriminde saklanır. Çevrim sadece görüntüleme (canlı kur, kaydedilmez).
5. **Bakiye:** Türetilmiş (saklanmaz), expenses + splits + confirmed settlements'tan PARA BİRİMİ BAZINDA hesaplanır.
6. **Para birimleri ASLA toplanmaz/çevrilmez:** Trend, kategori, dashboard hep tek para birimi bazında. Dominant para birimi otomatik belirlenir, diğerleri için not düşülür.
7. **RLS:** `is_member_of(gid)` SECURITY DEFINER — recursion'ı önler.
8. **Header mimarisi (KRİTİK):** Tabs `headerShown: false` (groups). Stack yönetir: `app/(tabs)/groups/_layout.tsx`. ASLA root Stack'e taşıma (alt bar kaybolur). ASLA nested `app/groups/[id]/_layout.tsx` (route çakışması).
9. **Realtime:** Supabase channel ile canlı güncelleme (masraf ekle/sil, bakiye, aktivite).
10. **IBAN:** HİÇBİR TABLODA KALICI SAKLANMAZ. Realtime broadcast channel ile anlık iletilir.
11. **Push:** Expo Go'da push ÇALIŞMAZ. Altyapı hazır. Dev build (Faz 8) bekleniyor.
12. **Monetizasyon — sadece User Pro:** RevenueCat SDK (client) + webhook (sunucu). Expo Go'da IAP çalışmaz — zarif fallback. `hasProAccess()` sadece `user_pro` kontrol eder. Group Pro kodu duruyor ama UI'da gizli.
13. **Pro entitlement:** Sunucuda (`profiles.user_pro`), client'ta değil. Webhook yazar. DEV-only toggle butonu (`__DEV__` guard) ile test edilebilir.
14. **Grup limiti:** 5 grup (demo hariç), User Pro ile sınırsız.
15. **Bugfix kaydı:** Her düzeltme/geliştirme `BUGFIX-CILA.md`'ye kaydedilir. B numarası ile takip.

---

## Proje Yapısı (güncel — Haziran 2026)

```
C:\Users\fatih\groopay\
  app/
    _layout.tsx                          # Root: QueryClient + AuthProvider + RevenueCatInit + Stack
    index.tsx                            # Auth gate
    paywall.tsx                          # Pro satın alma ekranı (modern fintech tasarım)
    (auth)/                              # Giriş
    (onboarding)/                        # Onboarding turu
    (tabs)/
      _layout.tsx                        # 4 tab: Gruplar · Panel · Aktivite · Hesap
      groups/
        _layout.tsx                      # Stack: index → [id] → add-expense → members → edit → new
        index.tsx                        # Grup listesi + genel bakiye özeti + join/new butonları
        [id]/
          index.tsx                      # Grup detay (masraflar/bakiyeler sekmeleri, FAB)
          add-expense.tsx                # Masraf ekle/düzenle (Wise numpad, split, tarih, diğer para birimi)
          members.tsx                    # Üye yönetimi (hayalet ekle, davet, yetki kontrolleri)
          edit.tsx                       # Grup düzenleme (ad, açıklama, renk, emoji, sil, ayrıl, devret)
      dashboard.tsx                      # Panel (hero + stats + kategori + Pro: trend bar chart)
      activity.tsx                       # Tüm gruplar aktivite akışı
      account.tsx                        # Profil, dil, Pro, restore, hesap silme, veri dışa aktarma
    join/                                # Kodla katılma + deep link
  lib/
    auth/                                # AuthProvider + useAuth
    supabase/                            # client, types, queries (getProDashboardAnalytics dahil)
    finance/                             # money, split, fx, balance, simplify, categories + tests (75/75)
    i18n/
    notifications/                       # registerPushToken, sendPushToUser, remindDebtor
    revenuecat/                          # RevenueCat SDK wrapper
  hooks/                                 # useGroups, useGroupDetail, useExpenses, useBalance, useFxRate, useSettlements, useRealtime, usePro
  components/                            # Toast, TabBarButton, Animations, TipsModal, TipsButton, Avatar, ProGate, ProBadge, ProFeatureRow
  constants/theme.ts                     # Design token'ları
  locales/ tr.json en.json               # i18n (tüm namespace'ler)
  supabase/
    migrations/                          # 0001-0007
    functions/
      join-via-invite/                   # Faz 3: davetle katılım
      send-push/                         # Faz 6: Expo Push API
      revenuecat-webhook/                # Faz 7: RevenueCat → DB entitlement
      delete-account/                    # Faz 8: hesap silme (Apple zorunlu)
  docs/                                  # groopay-scope.md, groopay-build-spec.md
  CLAUDE.md                             # Proje kuralları + bugfix kayıt kuralı
  BUGFIX-CILA.md                        # Tüm bugfix kayıtları (B1-B64)
  SESSION-OZET.md                       # Bu dosya
  FAZ0-PLAN.md ... FAZ7-PLAN.md
  .env
```

---

## Migration'lar

1. `0001_initial_schema.sql` — Tüm tablolar, RLS, trigger
2. `0002_invite_preview_rpc.sql` — preview_invite RPC
3. `0003_ghost_preview_rpc.sql` — preview_ghosts RPC
4. `0004_drop_fx_columns_add_expense_rpc.sql` — FX sütunları DROP + add_expense_with_splits RPC
5. `0005_realtime_publication.sql` — Realtime publication
6. `0006_settlements_currency_iban.sql` — Settlement para birimi + IBAN requests + 3 RPC
7. `0007_group_management.sql` — groups.description, avatar_emoji, avatar_color + delete_group, remove_member, transfer_ownership RPC
8. `0008_preferred_currency.sql` — profiles.preferred_currency (NULL = otomatik dominant)
9. `0009_rpc_auth_checks.sql` — **P0-1:** add_expense_with_splits, add_settlement, confirm_settlement, reject_settlement RPC'lere auth.uid() yetki kontrolü
10. `0010_rls_tighten.sql` — **P0-2:** expenses/settlements/group_members/groups RLS daraltma + is_founder_of helper
11. `0011_update_delete_expense_rpc.sql` — **P0-4:** update_expense_with_splits + delete_expense atomik RPC (SECURITY DEFINER)
12. `0012_fix_expense_splits_rls.sql` — RLS fix: 0011'de kaldırılan 4 politika geri eklendi
13. `0013_group_invite_rpc.sql` — **P1-1/P1-9:** create_group_with_limit (Pro limiti) + create_invite (kriptografik token) RPC
14. `0014_fix_delete_group_cascade.sql` — **B76:** delete_group sıralı silme (FK cascade fix)

---

## Edge Functions

| Fonksiyon | Durum |
|---|---|
| `join-via-invite` | ✅ Deploy edildi |
| `send-push` | ✅ Yazıldı, deploy bekliyor |
| `revenuecat-webhook` | ✅ P0-3: revoke handling eklendi, deploy bekliyor |
| `delete-account` | ✅ Yazıldı, deploy bekliyor |

---

## Bağlantı Bilgileri (.env)

```
EXPO_PUBLIC_SUPABASE_URL=https://dtlnujqtwlncwrxunihj.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_IZ_BD5POMsUMhOV7q2gZSw_Pi2qBAT6
EXPO_PUBLIC_REVENUECAT_APPLE_KEY=  (Faz 8'de doldurulacak)
EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY= (Faz 8'de doldurulacak)
```

## Başlatma Komutu

```powershell
cd C:\Users\fatih\groopay
npx expo start --tunnel --clear
```

## Güncel Kontroller

| Kontrol | Durum |
|---|---|
| `npx tsc --noEmit` | ✅ Temiz |
| Split + money testleri (vitest) | ✅ 87/87 geçti |
| P0 güvenlik: RPC auth.uid() | ✅ 7 RPC korumalı |
| P0 güvenlik: RLS daraltma | ✅ 6 tablo daraltıldı |
| P0 güvenlik: atomik mutation | ✅ update/delete expense |
| P0 güvenlik: RevenueCat revoke | ✅ EXPIRATION/CANCELLATION/REFUND |
| Para birimi: 2-ondalık sınırı | ✅ 18 para birimi, 0/3 UI'da gizli |
| Pro limiti: server-side | ✅ create_group_with_limit |
| Invite token: kriptografik | ✅ create_invite RPC |
| Add-expense: equal/custom/subset | ✅ Çalışıyor |
| Add-expense: diğer para birimi (20) | ✅ Modal seçim |
| Add-expense: canlı önizleme | ✅ Anlık |
| Add-expense: düzenleme modu | ✅ expenseId ile |
| Add-expense: tarih seçici | ✅ View-tabanlı takvim |
| Add-expense: numpad toggle | ✅ Detay açınca gizlenir |
| Dashboard: para birimi seçici | ✅ B57 |
| Profil: varsayılan para birimi | ✅ B57 |
| Dashboard: kategori formatlama | ✅ Gerçek para birimi |
| Pro model: sadece User Pro | ✅ Group Pro UI'da gizli |
| DEV Pro toggle | ✅ `__DEV__` guard |
| Header: çift header yok | ✅ Stack yönetiyor |
| Alt bar: 4 sekme | ✅ Gruplar · Panel · Aktivite · Hesap |
| Hesap silme | ✅ 3 adımlı |
| Veri dışa aktarma | ✅ JSON Share |
| Dashboard Tüm İşlemler | ✅ Pro: liste + filtre, Free: blur |
| Aktivite arama | ✅ Pro-gated, tr-TR debounce 300ms |
| Panel varsayılan sekme | ✅ `/dashboard` redirect |
| Hesap reorganizasyonu | ✅ 4 bölüm başlığı + klavye |
| Üye yönetimi | ✅ Inline panel + toggle |
| Yeni Grup / Gruba Katıl | ✅ Modal bottom sheet |
| Grup silme FK | ✅ Migration 0014 |

---

## Faz 8 İçin Kalanlar

- Google OAuth, iOS native Apple Sign In, Android Apple web OAuth ve misafir giriş aktif; production cihazında anonim → native Apple veri koruma akışı doğrulanacak
- `expo-apple-authentication` nedeniyle yeni iOS dev/production build alınacak (`EXPO_NO_CAPABILITY_SYNC=1` gerekebilir)
- RevenueCat webhook deploy + gerçek IAP testi (sandbox)
- send-push + delete-account Edge Function deploy
- Sentry/error monitoring (native module — EAS build ile)
- Gizlilik/şartlar URL'leri (Vercel)
- İkon, splash, ekran görüntüleri
- TestFlight / Internal Testing
- Erişilebilirlik son kontroller
- P2 cila: delete-account transaction, ownership edge case (launch sonrası)
- Para birimi integer minor unit migration (Faz 9)

---

*Son güncelleme: 2026-06-07 — B116 iOS native Apple Sign In eklendi*
