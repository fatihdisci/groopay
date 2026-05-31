# Faz 3 — Deploy Adımları

## ADIM 1: Edge Function Deploy

### Yöntem A — Supabase Dashboard (önerilen)

1. https://supabase.com/dashboard → projeni seç
2. Sol menü: **Edge Functions**
3. Sağ üst: **Create a new function** butonu
4. **Function name:** `join-via-invite`
5. Açılan kod editörüne `supabase/functions/join-via-invite/index.ts` dosyasının içeriğini kopyala-yapıştır
6. **Deploy** butonuna bas
7. Deploy tamamlanınca URL'yi not et (örn: `https://dtlnujqtwlncwrxunihj.supabase.co/functions/v1/join-via-invite`)

### Yöntem B — Supabase CLI (varsa)

```bash
cd C:\Users\fatih\groopay
npx supabase functions deploy join-via-invite
```

---

## ADIM 2: Edge Function'ı test et

Dashboard → Edge Functions → join-via-invite → **Details** sekmesinde:

1. **Authorization:** `Bearer <anon-key>` (anon key'ini .env'den al)
2. **Request body:**
```json
{
  "token": "TEST"
}
```
3. **Send** → `{"error": "invalid or expired invite code"}` dönmeli (çünkü TEST diye bir token yok — ama fonksiyon çalışıyor demek)

---

## ADIM 3: Tamam deyince devam

Edge Function deploy oldu + test çalıştı → bana ✅ yaz, kodun geri kalanına geçeyim.
