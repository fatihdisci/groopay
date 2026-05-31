# Groopay — Faz 3 Tamamlandı

> Son güncelleme: 2026-05-30

## Özet

Faz 3: Grup yönetimi (CRUD), üye sistemi (hayalet + gerçek), davet sistemi (kod + link), katılma akışı (hayalet devralma/claim), activity log.

## Yeni Dosyalar

```
supabase/
  functions/join-via-invite/index.ts     # Edge Function (Deno)
  migrations/
    0002_invite_preview_rpc.sql          # preview_invite RPC (RLS baypas)
    0003_ghost_preview_rpc.sql           # preview_ghosts RPC (RLS baypas)
app/
  groups/[id]/
    _layout.tsx                          # Stack layout (headerShown: false)
    index.tsx                            # Grup detay (üyeler + masraf/bakiye placeholder)
    members.tsx                          # Üye yönetimi (hayalet ekle/çıkar, davet)
  join/
    index.tsx                            # Kodla gruba katıl + hayalet claim (KeyboardAvoidingView)
    [token].tsx                          # Deep link handler
hooks/
  useGroupDetail.ts                      # Grup detay + üye + davet React Query hooks
FAZ3-DEPLOY.md                           # Edge Function deploy talimatı
```

## Değişen Dosyalar

| Dosya | Değişiklik |
|---|---|
| `lib/supabase/queries.ts` | createGroup, updateGroup, archiveGroup, deleteGroup, getGroupDetail, addGhostMember, deactivateMember, updateMember, createInvite, getGroupInvites, getInviteByToken (→ RPC), joinViaInvite, getGroupActivity |
| `lib/auth/AuthContext.tsx` | updateProfile → group_members display_name senkronizasyonu |
| `app/(tabs)/groups.tsx` | Tam grup listesi (FlatList), FAB ile oluştur, "Gruba Katıl", KeyboardAvoidingView modal |
| `app/(tabs)/account.tsx` | queryClient.clear() signOut'ta, cache temizliği |
| `app/_layout.tsx` | groups/[id] route'u + header ayarları |
| `app.json` | typedRoutes: false |
| `tsconfig.json` | supabase/functions exclude, .expo/types kaldırıldı |
| `locales/tr.json` + `en.json` | groups.*, groupDetail.*, members.* anahtarları |

## Route Yapısı (son hali)

```
app/
  _layout.tsx                    # Root Stack (headerShown: false, groups/[id] hariç)
  index.tsx                      # Auth gate: → (auth) / (onboarding) / (tabs)
  (auth)/
    _layout.tsx                  # Stack (headerShown: false)
    sign-in.tsx                  # Giriş ekranı
  (onboarding)/
    _layout.tsx                  # Stack (headerShown: false)
    intro.tsx                    # Onboarding turu
  (tabs)/
    _layout.tsx                  # 3 tab: Gruplar, Aktivite, Hesap
    groups.tsx                   # Grup listesi (FlatList + FAB)
    activity.tsx                 # Placeholder
    account.tsx                  # Profil düzenleme + çıkış
  groups/[id]/                   # ← tabs DIŞINDA (tab bar'da görünmez)
    _layout.tsx                  # Header yok (root Stack yönetiyor)
    index.tsx                    # Grup detay
    members.tsx                  # Üye yönetimi (modal)
  join/
    index.tsx                    # Kodla katılma + claim
    [token].tsx                  # Deep link
```

## Edge Functions

| Fonksiyon | Amaç |
|---|---|
| `join-via-invite` | Token doğrula → claim (hayalet devral) veya yeni üye ekle → activity log |
| `preview_invite` (SQL RPC) | Token doğrula + grup önizleme (RLS baypas — katılan kişi henüz üye değil) |
| `preview_ghosts` (SQL RPC) | Gruptaki hayalet üyeleri listele (RLS baypas) |

## Bugfix'ler (Faz 3 sonrası)

| Bug | Düzeltme |
|---|---|
| Çıkış sonrası yeni kullanıcıda eski grup bir an gözüküyor | `signOut`'ta `queryClient.clear()` |
| İlk katılmada ghost seçenekleri sorulmuyor | `preview_ghosts` RPC (RLS baypas) — SQL 0003 |
| Katılma sonrası grup gözükmüyor | Join sonrası `queryClient.invalidateQueries(['groups'])` |
| Profil adı değişince grup içinde güncellenmiyor | `updateProfile` → `group_members.display_name` güncelleme |
| Üye sayısı gruplar listesinde güncellenmiyor | `useAddGhostMember` / `useDeactivateMember` → `['groups']` cache invalidation |
| Grup detayda geri tuşu yok | `groups/[id]` tabs dışına taşındı, root Stack header yönetiyor |
| Klavye altında kalan input'lar | `KeyboardAvoidingView` join'e ve grup oluşturma modala eklendi |
| Paylaş butonu uzun metin | `Share.share({ message: code })` — sadece kod |

## Doğrulama

| Kriter | Durum |
|---|---|
| `npx tsc --noEmit` | ✅ |
| Grup oluşturma | ✅ |
| Hayalet üye ekleme | ✅ |
| Davet kodu + paylaşım | ✅ |
| Kodla katılma + claim (ilk seferde) | ✅ |
| RLS izolasyonu | ✅ |
| Geri tuşu | ✅ |
| Profil → grup senkronu | ✅ |

## Çalıştırma

```powershell
cd C:\Users\fatih\groopay
$env:REACT_NATIVE_PACKAGER_HOSTNAME="192.168.1.104"
npx expo start --lan
```
