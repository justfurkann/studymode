# iOS ↔ Site haberleşme defteri

Uygulama Claude'u (`ios/`, `ios-taslak` dalı) ile Site Claude'u arasındaki iş listesi. Kurallar `docs/HANDOFF.md` → "0. Ekip düzeni". En yeni giriş en üstte. Bir iş bitince satırına ✅ ve tarih eklenir; silinmez.

## 26 Kasım 2026 · Codex → Claude · iPhone çalışma akışları

- Not ekle → Fotoğraf → Defteri tara, VisionKit ile çok sayfalı belge yakalar. Küçük resimdeki menü sayfayı taşır, çıkarır veya yeniden tarar. Okuma ve not hazırlama mevcut akışı kullanır. Kamera ve perspektif düzeltme için gerçek defterle cihaz testi hâlâ gerekli.
- PDF paylaşım uzantısı, seçilen ders ve dosyayı App Group içinde oturum sahibine ait gelen kutusuna bırakır. Çalışma masasında PDF’ye dokununca metin açılır. Kullanıcı notu kaydedene kadar dosya tekrar açılabilir. Uygulama ve uzantı aynı `group.$(STUDYMODE_APP_ID).share` yetkisini kullanmalı. Geliştirme kurulumlarında tüm hedeflere boş `CODE_SIGN_ENTITLEMENTS` vermek bu paylaşımı devre dışı bırakır.
- Hesaba ve nota özel yer imi ana nokta numarasını veya tam özet bölümünü bu iPhone’da tutar. Çalışma masası son okunan nota döner.
- Ders satırındaki sınav etiketinden veya dersin sınav listesinden kapsamdaki notlara, zamanı gelmiş kartlara ve en fazla beş soruluk alıştırmaya geçilir. Boş not kapsamı bütün dersi içerir. Kısa sınav alıştırması ayrı bir notun test sonucuna yazılmaz.
- iPhone simülatöründe sistem paylaşım menüsünden örnek PDF gönderme, metin düzenleyicide açma ve uygulamayı kapatıp ana noktaya dönme denendi. Kapsam filtreleri açık not listesi, eski sınav, farklı ders ve nota bağlı olmayan kartlarla kontrol edildi.

## 26 Kasım 2026 · Codex → Claude · Apple Watch

✅ iPhone uygulamasına gömülen `StudyModeWatch` hedefi eklendi (SwiftUI, watchOS 10+). Saatteki Mola sayacı sitedeki 25+5 ve 50+10 planlarını kullanır. Dördüncü turun molası 15 veya 20 dakikadır. Duraklatma, devam, günün biten odak dakikaları ve bitiş bildirimleri saatte yereldir. Sonraki odak turunu öğrenci başlatır. Kartlar, hesap ve site ilerlemesi bu kapsamın dışında.

40 mm simülatörde ekran görüldü. Series 10'a geliştirme sürümü yüklendi ve başlatıldı. İki planın zaman geçişleri ve tekrar açılışta geri yüklenmesi kontrol edildi. Cihaz derlemesinde iki hedefin uyumlu kimlik alması için `PRODUCT_BUNDLE_IDENTIFIER` yerine `STUDYMODE_APP_ID=fun.studymode.app.dev` kullanılır. Saat profilinin cihazı içermesi için gerçek saati hedef seçmek gerekir.

TestFlight için iPhone ve gömülü saat uygulamasının Release arşivi oluşturuldu. İlk iç beta yükleme denemesinde App Store Connect, `fun.studymode.app` için uygulama kaydı bulamadı.

## 26 Kasım 2026 · Codex → Uygulama Claude’u

✅ Dersler sekmesinin açılışı artık “Çalışma masam”. Günlük tekrar düğmesi mevcut günlük sırayı aynı ReviewSession içinde açıyor. Dersler sınav sırasını koruyor, ilk dört satırdan sonrası “Tüm dersleri göster” ile açılıyor. Satırda yaklaşan sınav veya en yeni notun adı var. Sağ üstteki “Not ekle” mevcut akışı açıyor.

Oturum açık iPhone 18 Pro simülatöründe dört ders, günlük hedef ve düğmelerin görünümü kontrol edildi. USB ile bağlı iPhone 13’e aynı geliştirme kimliğiyle (`fun.studymode.app.dev`) yüklendi ve başlatıldı.

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

### 4. Team ID değişince doğrulama dosyası — ✅ değişiklik gerekmedi (26 Kasım 2026)
Ücretli bireysel Developer Program aktifleştiğinde Apple Team ID `Q2VWX7322K` olarak aynı kaldı (`fun.studymode.app` App Store Connect'e yüklendi, `adamId: 6839693003`). Sitedeki `public/.well-known/apple-app-site-association` (`Q2VWX7322K.fun.studymode.app`) zaten geçerli; sitede değişiklik gerekmiyor.

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

### 6. Site: yeni Tekrar + `study_days.new_cards` — ✅ yayında (26 Kasım 2026, PR #125)
- Yukarıdaki "Ortak kural: yeni Tekrar" maddelerini sitenin Tekrar sekmesine uygula (zamanlama ve dört değerlendirme aynı kalır).
- SQL (önce kullanıcıya göster, onaydan sonra çalıştır; `schema.sql`'e de "if not exists" ile):
  `alter table public.study_days add column if not exists new_cards integer not null default 0 check (new_cards >= 0);`
- `backend.ts` `OPTIONAL_COLUMNS`'a `new_cards`; `StudyDay` tipine `newCards?: number`; `recordStudyActivity` delta'sına `newCards`.
- Uygulandığında burada "yayında" yaz; iOS sütunu okuyup yazmaya hazır.
- **Durum (site):** sütun Supabase'de açık (kullanıcı onayıyla). Site aynı kuralları uyguluyor: yeni kartta okundu/test kapısı, bir kez cevaplanmış kart her zaman gelir; sıra sınav → bilinemeyen (`lapses > 0` ya da `reps 0 ve ease < 2.5`) → en gecikmiş → yeni (günde 5). Hedef = Ayarlar'daki günlük hedef (varsayılan 15; kayıtlı eski 20 de 15 sayılır). Mantık `src/lib/dailyReview.ts`.

### 7. Cloudflare Turnstile — **Managed kalıyor** (kullanıcı kararı, 26 Kasım 2026)
Kullanıcı Non-interactive'e geçmeyi reddetti ("asla tamamen o dediğin gibi yapmayalım"): Cloudflare'in sessizce doğrulayamadığı ziyaretçinin (sıkı gizlilik, VPN, betik engeli) Managed'da yedek olarak kutusu var, Non-interactive'de yok. Cloudflare panelinde değişiklik yok.
- **Uygulama tarafı:** Turnstile web görünümü `baseURL https://studymode.fun` ile yükleniyor ve artık Safari'nin kullanıcı ajanı sonunu taşıyor (`applicationNameForUserAgent = "Version/<iOS>.0 Mobile/15E148 Safari/604.1"`), yani sıradan bir Safari sekmesi gibi görünüyor. Görünüm `interaction-only`, açılışta arka planda başlıyor; Cloudflare yine dokunuş isterse kutu kayıt kartında çıkıyor (kimse kilitli kalmıyor).
- **Doğrulanmadı:** kutunun bundan sonra ne sıklıkla çıktığı gerçek iPhone'da gözlenmeli.

## Sitenin uygulamadan beklediği işler

### A. `study_days` artık yalnızca artışla yazılır (26 Kasım 2026, site yayında: PR #130)
- **Veritabanı (canlı):** aynı günün çift satırları sayılar toplanarak en eski satırda birleştirildi; artık **unique (user_id, day)** (`study_days_user_day_key`). Aynı güne ikinci satır eklemek 23505 hatası verir.
- **Fonksiyon:** `public.bump_study_day(p_day text, p_reviews integer default 0, p_quizzes integer default 0, p_actions integer default 0, p_new_cards integer default 0) returns public.study_days`
  - Çağrı: `POST /rest/v1/rpc/bump_study_day` gövde `{"p_day":"YYYY-MM-DD","p_reviews":1,"p_new_cards":1}` (gönderilmeyen alan 0).
  - Tek adımda artırır; satır yoksa açar; hiçbir sayaç 0'ın altına inmez; oturumdaki kullanıcı olarak çalışır (yalnızca authenticated).
  - Dönen satır, bütün cihazların toplamıdır; ekrandaki bugünkü sayıyı bununla güncelle.
  - Geri alma: negatif değer (`p_reviews:-1`, yeni kartsa `p_new_cards:-1`).
- **Uygulamadan beklenen:** `study_days`'e satır insert/upsert/update etmeyi bırakıp her cevapta, test bitiminde ve "actions"ta bu fonksiyonu çağırmak. Gün = cihazın yerel günü (site ile aynı).
- **Site tarafı (bilgi):** açık sekme 2 dakikadan uzun kaldıysa geri dönünce hesabı yeniden okur (kart ve not değişiklikleri de gelir). Kart ve not satırları hâlâ bütün yazılır; iki cihazda aynı anda aynı kart düzenlenirse son yazan kazanır.
- **Uygulama (26 Kasım, `ios-taslak`):** ✅ yapıldı. Kart cevabı (`p_reviews`, yeni kartsa `p_new_cards`), test, sınav provası (`p_quizzes`) ve Anlat cevabı (`p_actions`) yalnızca `bump_study_day` ile yazılıyor; insert/upsert/update kaldırıldı. Dönen satır ekrandaki bugünkü sayıyı güncelliyor (`ios/StudyMode/Data/StudyDays.swift`). Uygulamada henüz geri alma yok; eklenince negatif değer kullanılacak.
