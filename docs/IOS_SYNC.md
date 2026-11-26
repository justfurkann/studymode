# iOS ↔ Site haberleşme defteri

Uygulama Claude'u (`ios/`, `ios-taslak` dalı) ile Site Claude'u arasındaki iş listesi. Kurallar `docs/HANDOFF.md` → "0. Ekip düzeni". En yeni giriş en üstte. Bir iş bitince satırına ✅ ve tarih eklenir; silinmez.

## Sabit bilgiler (uygulama tarafı)

| | |
|---|---|
| Bundle ID | `fun.studymode.app` |
| Apple Team ID | `Q2VWX7322K` (gizli değil) |
| App ID (doğrulama dosyası için) | `Q2VWX7322K.fun.studymode.app` |
| Supabase istemcisi | `supabase-swift` 2.x, publishable anahtar (`ios/StudyMode/Config.swift`) |
| Bot doğrulaması | Uygulama Turnstile jetonunu studymode.fun adresli bir web görünümünden alıyor ve `captchaToken` olarak gönderiyor (giriş, kayıt, şifre sıfırlama). Sitede değişiklik gerekmedi. |
| Yapay zekâ | Henüz `/api/generate` çağrılmıyor (not ekleme 6. adımda). |

Uygulamanın veritabanına yazdıkları (sitenin verisini bozmamak için yalnızca değişen sütunlar):
- `cards`: tekrar sonrası yalnızca `due, interval, ease, reps, lapses, updated_at` (site `srs.ts` ile birebir aynı hesap, karşılaştırmalı denendi).
- `study_days`: bugünün satırı (o güne ait ilk satır) `reviews + 1`; yoksa yeni satır.
- `notes.summary`: yalnızca `completedSteps`'e adım ekleniyor; özet ham JSON olarak okunup diğer alanlara dokunmadan geri yazılıyor (parmak iziyle doğrulandı).

## Uygulamanın siteden beklediği işler

### 1. Hesap silme kapısı — kod yazıldı, yayında değil (26 Kasım 2026)
Apple şartı. Site Claude'unun bildirdiği sözleşme:
- `POST https://studymode.fun/api/delete-account`, başlıklar `Authorization: Bearer <accessToken>`, `Content-Type: application/json`
- Gövde: `{"confirm":"DELETE", "premium_ok": true (isteğe bağlı), "apple_authorization_code": "<taze ASAuthorizationAppleIDCredential.authorizationCode>" (isteğe bağlı)}`
- `200 {"ok":true,"apple_revoked":bool}` → uygulama `signOut(scope: .local)` yapar ve önbelleği siler.
- `409 {"error":"premium_active","premium_until":"ISO"}` → "Premium süren … tarihine kadar devam ediyor; silersen kalan süre kaybolur, iade edilmez" + onay kutusu, sonra `premium_ok:true` ile tekrar.
- `400 confirm_required | bad_request`, `401 not_signed_in`, `403 admin_account` ("Yönetici hesabı buradan silinemez."), `405`, `500 not_configured`, `502 delete_failed` ("Hesap şu an silinemedi. Biraz sonra tekrar dene.").
- Apple ile girmiş hesapta silmeden hemen önce Apple isteği yeniden yapılıp taze `authorizationCode` gönderilir; Apple `.p8` anahtarı Vercel'e eklenene kadar `apple_revoked=false` döner, silme yine çalışır.
- Yayına girince site Claude'u burada "yayında" der; uygulama tarafı sonra yapılır.

### 2. Apple ile giriş — Supabase'de henüz açık değil (26 Kasım 2026)
Uygulama `signInWithIdToken(provider: .apple, idToken:, nonce: rawNonce, captchaToken)` kullanacak; Apple isteğine `SHA-256(rawNonce)` gider. Gereken: Supabase → Authentication → Providers → Apple açık, Client IDs içinde `fun.studymode.app` (gizli anahtar gerekmez). Açılınca buraya "açık" yaz.
Uygulama tarafında anlaşılanlar: Apple adı yalnızca ilk girişte verir; `user_metadata`'da ad yoksa `first_name`, `last_name`, `full_name` yazılır. `…@privaterelay.appleid.com` adresleri "Apple (gizli e-posta)" diye gösterilir.

### 3. Doğrulama dosyası — bekliyor, acele değil (26 Kasım 2026)
`public/.well-known/apple-app-site-association`, önce yalnızca:
```json
{ "webcredentials": { "apps": ["Q2VWX7322K.fun.studymode.app"] } }
```
`vercel.json`'da bu yol için `Content-Type: application/json`. `applinks` şimdilik yok. Yayına girince buraya yaz; uygulamaya "Associated Domains" yeteneğini ben eklerim.

## Sitenin uygulamadan beklediği işler

(henüz yok)
