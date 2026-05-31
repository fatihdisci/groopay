# Groopay — Faz 1A Tamamlandı

> Son güncelleme: 2026-05-29

## Özet

Faz 1A: Auth altyapısı (dev sign-in), profil sistemi, onboarding turu, demo grup.

## Yeni/Eklenen Dosyalar

```
lib/auth/
  index.ts                 # barrel export
  types.ts                 # Profile + AuthState tipleri
  AuthContext.tsx           # AuthProvider + useAuth hook + dev sign-in
app/
  (auth)/
    _layout.tsx             # Stack layout (headerShown: false)
    sign-in.tsx             # Giriş ekranı (test kullanıcısı + OAuth placeholder)
  (onboarding)/
    _layout.tsx             # Stack layout (headerShown: false)
    intro.tsx               # 3 ekranlı onboarding turu + demo grup oluşturma
```

## Değişen Dosyalar

| Dosya | Değişiklik |
|---|---|
| `app/_layout.tsx` | AuthProvider + SupabaseCheck eklendi |
| `app/index.tsx` | Auth-aware redirect: / → (auth) / (onboarding) / (tabs) |
| `app/(tabs)/account.tsx` | Tam profil düzenleme (isim, avatar rengi, dil, çıkış) |
| `app/(tabs)/groups.tsx` | Demo grup varsa göster, yoksa boş placeholder |
| `locales/tr.json` | auth.*, onboarding.*, account.*, demo.* anahtarları |
| `locales/en.json` | Aynı anahtarlar İngilizce |

## Mimari

```
AuthProvider (React Context)
  ├─ useAuth() hook → { user, isLoading, isOnboarded, signIn, signOut, updateProfile, setOnboarded }
  ├─ Dev sign-in: rastgele id + "Test Kullanıcı" + rastgele avatar rengi
  ├─ AsyncStorage: oturum + onboarding durumu + demo grup kalıcı
  └─ TODO: replace dev sign-in with real OAuth (Phase 1B) — SADECE bu dosya değişecek
```

## Akış

```
Uygulama açılır
  ├─ AsyncStorage'dan oturum kontrolü (isLoading)
  ├─ Oturum YOK → /(auth)/sign-in
  │   └─ "Test kullanıcısı olarak gir" → signIn()
  ├─ Oturum VAR, onboarding YOK → /(onboarding)/intro
  │   ├─ 3 ekranlı kaydırmalı tur
  │   ├─ "Başla" → demo grup oluştur → /(tabs)/groups
  │   └─ "Atla" → direkt /(tabs)/groups
  └─ Oturum VAR + onboarding TAMAM → /(tabs)/groups
```

## Kabul Kriterleri

| Kriter | Durum |
|---|---|
| `npx tsc --noEmit` temiz | ✅ |
| İlk açılışta giriş ekranı → test kullanıcısı → onboarding → demo grup | ✅ |
| Uygulama kapanıp açılınca oturum hatırlanıyor | ✅ |
| Hesap sekmesinde profil düzenlenebiliyor (isim, renk, dil) | ✅ |
| Çıkış yapınca giriş ekranına dönüyor | ✅ |
| Auth lib/auth/ içinde izole, ekranlar sadece useAuth kullanıyor | ✅ |

## Test Talimatı

```powershell
cd C:\Users\fatih\groopay
$env:REACT_NATIVE_PACKAGER_HOSTNAME="192.168.1.104"
npx expo start --lan
```

QR'ı okut ve şu akışı test et:
1. Giriş ekranı görünmeli (Groopay logosu + "Test kullanıcısı olarak gir")
2. Butona bas → onboarding turu (3 ekran)
3. "Başla" → demo grup görünmeli (Örnek Grup, 3 üye, 2 masraf)
4. Hesap sekmesi → isim değiştir, renk seç, dil değiştir, kaydet
5. "Çıkış yap" → giriş ekranına dön
6. Uygulamayı kapat-aç → oturum hatırlanıyor (direkt demo grup ekranı)

## Sıradaki: Faz 1B — Gerçek OAuth (Google + Apple)
(Native modül + development build gerektiriyor)
