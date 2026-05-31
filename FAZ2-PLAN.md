# Groopay — Faz 2 Tamamlandı

> Son güncelleme: 2026-05-30

## Özet

Faz 2: Veri modeli (migration + RLS), Supabase anonim auth, demo grup Supabase'e yazma, React Query veri katmanı.

## Yeni Dosyalar

```
supabase/migrations/
  0001_initial_schema.sql    # Tam şema (enumlar, 8 tablo, indeksler, RLS, trigger)
lib/supabase/
  types.ts                   # Tüm veritabanı tip tanımları (build-spec uyumlu)
  queries.ts                 # Tip-güvenli sorgu fonksiyonları (getMyGroups, createDemoGroup...)
hooks/
  useGroups.ts               # React Query hook (getMyGroups)
```

## Değişen Dosyalar

| Dosya | Değişiklik |
|---|---|
| `lib/auth/AuthContext.tsx` | Dev sign-in → **Supabase anonim auth** (`signInAnonymously`). Artık `profiles` tablosundan okuyor/yazıyor |
| `app/(auth)/sign-in.tsx` | `signIn` async hata yönetimi + loading state |
| `app/(onboarding)/intro.tsx` | Demo grup **Supabase'e yazılıyor** (`createDemoGroup`), loading state |
| `app/(tabs)/groups.tsx` | AsyncStorage → **React Query + Supabase** (`useGroups`) |

## Mimari Değişiklikler

### Auth
```
Eski: AsyncStorage'da sahte kullanıcı
Yeni: Supabase anonim auth → auth.users + profiles (trigger ile otomatik)
TODO Phase 1B: supabase.auth.linkIdentity() ile Google/Apple'a yükseltme
```

### Veri
```
Eski: AsyncStorage'da demo grup (local)
Yeni: Supabase groups + group_members + expenses + expense_splits tabloları
      React Query ile okuma (staleTime: 30s, Faz 5'te Realtime'a geçecek)
```

## Migration (çalıştırıldı ✅)

`supabase/migrations/0001_initial_schema.sql`:
- 3 enum, 8 tablo, 9 indeks
- `is_member_of(gid uuid)` SECURITY DEFINER → recursion tuzağı önlendi
- Tüm tablolarda RLS açık, her tabloya politikalar
- `handle_new_user` trigger → yeni auth kullanıcısına otomatik profil satırı

## ⚠️ Supabase Ayarları (önemli!)

**Anonim giriş için:** Supabase Dashboard → Authentication → Settings → **Allow Anonymous Sign-ins** → AÇIK

1. [Supabase Dashboard](https://supabase.com/dashboard) → projeni seç
2. Sol menü: **Authentication** → **Settings**
3. **Anonymous Sign-ins** → toggle'ı AÇ
4. **Save** 'e bas

Bu ayar olmadan uygulama hata verir.

## Test Planı

1. Supabase'de anon auth'u aç
2. Uygulamayı aç (eski AsyncStorage verisini temizlemek için uygulamayı silip yeniden yükle ya da Hesap'tan çıkış yap)
3. "Test kullanıcısı olarak gir" → anonim oturum açılır → Supabase auth.users + profiles satırı oluşur
4. Onboarding → "Başla" → demo grup Supabase'e yazılır
5. Gruplar sekmesi → demo grup gösterilir (Supabase'den okur)
6. Hesap → profil düzenle → Supabase profiles güncellenir
7. Çıkış → tekrar giriş → profil bilgileri kalıcı (Supabase'den gelir)
8. RLS testi: başka cihaz/simülatör ile farklı anonim kullanıcı → ilk kullanıcının grubunu göremez
