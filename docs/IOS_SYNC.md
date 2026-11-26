# iOS ↔ Site haberleşme defteri

Uygulama Claude'u (`ios/`, `ios-taslak` dalı) ile Site Claude'u arasındaki iş listesi. Kurallar `docs/HANDOFF.md` → "0. Ekip düzeni". En yeni giriş en üstte. Bir iş bitince satırına ✅ ve tarih eklenir; silinmez.

## Sabit bilgiler (uygulama tarafı)

| | |
|---|---|
| Bundle ID | `fun.studymode.app` |
| Apple Team ID | `Q2VWX7322K` (gizli değil). **Dikkat (26 Kasım):** bu, kullanıcının ücretsiz *Personal Team* kimliği; ücretli Developer Program henüz hesaba yansımadı (48 saate kadar sürebilir). Ücretli ekip açılınca Team ID büyük ihtimalle değişecek → doğrulama dosyası ve bu tablo güncellenmeli. Kişisel ekip Apple ile giriş ve Associated Domains yetkisi vermiyor; o güne kadar telefonda deneme `fun.studymode.app.dev` kimliğiyle, bu iki özellik kapalı yapılır. |
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
✅ **Yayında (26 Kasım 2026, PR #124, Vercel READY).** Canlıda denendi: jetonsuz POST → 401 `not_signed_in`, GET → 405. Gerçek silme yalnızca test hesabıyla denenmeli. Sözleşme aşağıdaki gibi, değişmedi. Uygulama tarafı yapılabilir.
Apple şartı. Site Claude'unun bildirdiği sözleşme:
- `POST https://studymode.fun/api/delete-account`, başlıklar `Authorization: Bearer <accessToken>`, `Content-Type: application/json`
- Gövde: `{"confirm":"DELETE", "premium_ok": true (isteğe bağlı), "apple_authorization_code": "<taze ASAuthorizationAppleIDCredential.authorizationCode>" (isteğe bağlı)}`
- `200 {"ok":true,"apple_revoked":bool}` → uygulama `signOut(scope: .local)` yapar ve önbelleği siler.
- `409 {"error":"premium_active","premium_until":"ISO"}` → "Premium süren … tarihine kadar devam ediyor; silersen kalan süre kaybolur, iade edilmez" + onay kutusu, sonra `premium_ok:true` ile tekrar.
- `400 confirm_required | bad_request`, `401 not_signed_in`, `403 admin_account` ("Yönetici hesabı buradan silinemez."), `405`, `500 not_configured`, `502 delete_failed` ("Hesap şu an silinemedi. Biraz sonra tekrar dene.").
- Apple ile girmiş hesapta silmeden hemen önce Apple isteği yeniden yapılıp taze `authorizationCode` gönderilir; Apple `.p8` anahtarı Vercel'e eklenene kadar `apple_revoked=false` döner, silme yine çalışır.
- Yayına girince site Claude'u burada "yayında" der; uygulama tarafı sonra yapılır.
- **Uygulama durumu (26 Kasım):** Hesap → "Hesabı sil…" (SİL onayı, Premium uyarısı ve `premium_ok`, başarıda `signOut(scope: .local)`) yazıldı, derleniyor. Gerçek silme denenmedi (yalnızca atılabilir hesapla denenecek). Apple `authorization_code` gönderimi Apple ile giriş eklenince yapılacak.

### 2. Apple ile giriş — Supabase'de henüz açık değil (26 Kasım 2026)
✅ **Supabase'de açık (26 Kasım 2026)**: `/auth/v1/settings` → `apple: true`, Client IDs `fun.studymode.app`, gizli anahtar yok. Uygulama tarafı yapılabilir. Sitedeki "Apple ile devam et" aynı kimlik belirteci yolunu kullanır (Services ID gelince açılır).
Uygulama `signInWithIdToken(provider: .apple, idToken:, nonce: rawNonce, captchaToken)` kullanacak; Apple isteğine `SHA-256(rawNonce)` gider. Gereken: Supabase → Authentication → Providers → Apple açık, Client IDs içinde `fun.studymode.app` (gizli anahtar gerekmez). Açılınca buraya "açık" yaz.
- **Uygulama durumu (26 Kasım):** giriş/kayıt kartında Apple'ın kendi "Apple ile Devam Et" düğmesi; ham nonce + SHA-256, `captchaToken` ile `signInWithIdToken`; ilk girişte ad `auth.update` ile yazılıyor; Apple hesabında silmeden önce Apple'dan taze `authorizationCode` alınıp `apple_authorization_code` olarak gönderiliyor. Gerçek Apple girişi henüz denenmedi (kullanıcının iPhone'unda denenecek).
Uygulama tarafında anlaşılanlar: Apple adı yalnızca ilk girişte verir; `user_metadata`'da ad yoksa `first_name`, `last_name`, `full_name` yazılır. `…@privaterelay.appleid.com` adresleri "Apple (gizli e-posta)" diye gösterilir.

### 3. Doğrulama dosyası — bekliyor, acele değil (26 Kasım 2026)
✅ **Yayında (26 Kasım 2026, PR #124).** `https://studymode.fun/.well-known/apple-app-site-association` → 200, `content-type: application/json`, yönlendirme yok, yalnızca `webcredentials` (`Q2VWX7322K.fun.studymode.app`). Associated Domains (`webcredentials:studymode.fun`) uygulamaya eklenebilir.
`public/.well-known/apple-app-site-association`, önce yalnızca:
```json
{ "webcredentials": { "apps": ["Q2VWX7322K.fun.studymode.app"] } }
```
`vercel.json`'da bu yol için `Content-Type: application/json`. `applinks` şimdilik yok. Yayına girince buraya yaz; uygulamaya "Associated Domains" yeteneğini ben eklerim.
- **Uygulama durumu (26 Kasım):** `ios/StudyMode.entitlements` → `webcredentials:studymode.fun`, e-posta alanı `.username`. Gerçek iPhone'da denenmedi (simülatörde şifre önerisi çıkmaz).

### 4. Team ID değişince doğrulama dosyası — bekliyor (26 Kasım 2026)
Ücretli ekip açılınca uygulama Claude'u yeni Team ID'yi buraya yazar; site `public/.well-known/apple-app-site-association` içindeki `Q2VWX7322K.fun.studymode.app`'i günceller.

### 5. Google ile giriş (uygulama) — kullanıcının panel işi bekleniyor (26 Kasım 2026)
Uygulama Google'ın SDK'sı olmadan, Google'ın **iOS türünde** OAuth istemcisiyle (PKCE) kimlik belirteci alıp `signInWithIdToken(provider: .google, nonce: ham, captchaToken)` çağırıyor; Google'a SHA-256(nonce) gidiyor (sitedeki gibi). Gerekenler (kullanıcı yapar, sitenin koduna dokunulmaz):
- Google Cloud → Credentials → yeni OAuth istemcisi, tür **iOS**, bundle `fun.studymode.app`.
- Supabase → Authentication → Providers → Google → **Client IDs** listesine bu iOS Client ID'si eklenir (sitenin web Client ID'si yerinde kalır, virgülle ayrılır). "Skip nonce check" kapalı kalır.
Site Claude'u için not: sitenin Google girişine etkisi olmamalı; bir değişiklik görürsen bana yaz.
- **Durum (26 Kasım):** iOS Client ID oluşturuldu, sitenin projesinde (`189951485932-3f3jkvijibcnib8ov3opp4gn7h7ln2jl.apps.googleusercontent.com`, gizli değil) ve uygulamaya kondu. Bekleyen: Supabase → Google → Client IDs'e eklenmesi (kullanıcı) ve Google Auth Platform'da branding doldurulup uygulamanın yayınlanması (kullanıcı). Sitenin Google projesinin branding/yayın durumu belirsiz; site Claude'u bakabilirse iyi olur.

## Ortak kural: yeni Tekrar (26 Kasım 2026, kalite kontrolden; önce iOS'ta denenir, sonra site)

Kaynak: kalite kontrol Claude'unun önerisi, kullanıcı onayladı. "15 kart" ve "günde 5 yeni" veriye dayanmıyor, tahmin; uygulamada denenip ayarlanacak. Asıl amaç sınırın olması.

**Değişmeyen:** tekrar zamanlaması (`src/lib/srs.ts` `schedule`, iOS'ta `SRS.swift`, birebir aynı) ve dört değerlendirme (Bilemedim / Zor / İyi / Kolay).

**Kurallar**
1. **Günde tek oturum.** Gün = cihazın yerel günü (`localDayKey`). Varsayılan hedef **15 kart** (~5 dk). Hedefin ilerlemesi `study_days.reviews` (bugünün satırı) üzerinden sayılır; böylece site ve uygulama aynı sayıyı görür.
2. **Bitince "Bugün tamam" ekranı.** İsteğe bağlı **"Biraz daha"** aynı kurallarla **+10 kart** ekler (sınırsız tekrarlanabilir).
3. **Kuyruğa kim girer:** yalnızca **özeti okunmuş ya da testi çözülmüş** notların kartları.
   - **Uygulama Claude'unun eklediği yorum (26 Kasım, kalite kontrol baksın):** bu şart yalnızca **hiç görülmemiş yeni kartlar** için uygulanıyor. En az bir kez cevaplanmış bir kart, notunun adımları ne olursa olsun zamanı gelince tekrara girer. Sebep: test hesabında 70 kartın hepsi elendi (hiçbir notta `tanis`/`anla` yok, test sonucu yok); bugün çalışılmış 8 kart bile bir daha gelmeyecekti, yani unutulacaktı. Kuralın amacı yeni kart yağmurunu kesmek; eski kartları kesmek değil.
   - Uygulamada özet ekranı artık adımı işaretliyor: "Devam: Ana noktalar" → `tanis`, ana noktaların sonunda "Kartlarla pekiştir" → `anla` (sitedekiyle aynı yerler). Önceden işaretlemiyordu.
   - Özeti okunmuş = `summary.completedSteps` içinde `tanis` veya `anla` var.
   - Testi çözülmüş = `quiz_attempts` içinde o nota ait en az bir satır var.
   - Nota bağlı olmayan kartlar (`note_id` boş: elle eklenen) **girer** (kullanıcı kararı, 26 Kasım).
4. **Yeni kart** (`reps = 0` ve `lapses = 0`): günde en fazla **5** tanesi kuyruğa girer. Diğerleri (zamanı gelmiş tekrarlar) sınırsız aday, ama oturum 15'te durur.
   - "Bugün kaç yeni kart başladı" **veritabanında** sayılır (kullanıcı kararı, 26 Kasım): `study_days.new_cards` (aşağıda madde 6, site yapar). Yeni bir kart ilk kez cevaplanınca (cevaptan önce `reps = 0` ve `lapses = 0` ve `ease = 2.5`) bugünün satırında `reviews + 1` ile birlikte `new_cards + 1`. Sütun yokken iOS cihazda sayar ve kaydı bozmaz.
5. **Sıra:** (a) en yakın sınavı olan dersin kartları önce (sınavsız dersler en sona; sınav = o kartın notunu kapsayan en yakın gelecek sınav, `examDateForCard` ile aynı), (b) aynı ders içinde **daha önce bilinemeyenler** önce (`lapses > 0` ya da `reps = 0` iken tekrar edilmiş = son cevabı Bilemedim olan), (c) sonra en çok gecikmiş (`due` en eski), (d) yeni kartlar en sonda (5 sınırıyla).
6. **Ekranda toplam kart sayısı gösterilmez** (ör. "70 kart bekliyor" yok). Görünenler: **bugünkü hedef** (ör. 4/15) ve **ders bazında hazırlık** (`examReadiness` ile aynı formül; sınavı olan derslerde sınavın notları, olmayanlarda dersin bütün notları).
   - Sekme rozeti: bugünkü hedeften kalan (ör. 11), hedef bitince rozet yok.
7. "Bilemedim" denen kart aynı oturumun sonuna döner (bugünkü gibi); hedef sayacı her cevapta 1 artar.

**iOS durumu:** taslak onaylandı (26 Kasım), kodlanıyor. **Site:** kullanıcı istedi, site Claude'u aynısını siteye yapar (madde 6).

### 6. Site: yeni Tekrar + `study_days.new_cards` — bekliyor (26 Kasım 2026)
- Yukarıdaki "Ortak kural: yeni Tekrar" maddelerini sitenin Tekrar sekmesine uygula (zamanlama ve dört değerlendirme aynı kalır).
- SQL (önce kullanıcıya göster, onaydan sonra çalıştır; `schema.sql`'e de "if not exists" ile):
  `alter table public.study_days add column if not exists new_cards integer not null default 0 check (new_cards >= 0);`
- `backend.ts` `OPTIONAL_COLUMNS`'a `new_cards`; `StudyDay` tipine `newCards?: number`; `recordStudyActivity` delta'sına `newCards`.
- Uygulandığında burada "yayında" yaz; iOS sütunu okuyup yazmaya hazır.

### 7. Cloudflare Turnstile: "Managed" → "Non-interactive" — kullanıcının panel işi (26 Kasım 2026)
Uygulamada kutu hâlâ çıkıyor (kullanıcı, gerçek iPhone). Uygulama tarafında yapılabilecek her şey yapıldı (`appearance: 'interaction-only'`, açılışta arka planda başlatma). Cloudflare, uygulama içi web görünümünü sık sık "etkileşim gerekli" sayıyor. Çözüm Cloudflare panelinde: Turnstile → studymode.fun widget'ı → **Widget Mode: Non-interactive**. Aynı site anahtarı, aynı gizli anahtar; Supabase'de değişiklik yok. Etkisi: sitede de kutu tıklama istemez (kontrol arka planda sürer). Site Claude'u için: sitede ayrıca bir değişiklik gerekmez; istersen `appearance: 'interaction-only'`'yi sitede de kullanabilirsin.

## Sitenin uygulamadan beklediği işler

(henüz yok)
