# StudyMode Android — plan ve notlar

Android Claude'unun çalışma planı ve defteri. Rol tarifi: `docs/ROLES.md` → "C. Android". Ekip düzeni: `docs/HANDOFF.md` → "0. Ekip düzeni". Kapsam örneği: `ios/PLAN.md` (ios-taslak dalındaki güncel hâli).

Bu dosya şimdilik **yalnızca plan**: henüz kod yok. Kod adım adım, aşağıdaki tabloya göre yazılacak.

> **Temel kural: site ile uygulama eşittir.** Sitede olan her şey uygulamada da olacak. Hiçbir sorun bir özelliği **silerek** çözülmez; Premium dışı özellikler de buna dahil. İlk sürüme yetişmeyen bir özellik plandan çıkarılmaz, "sonraki sürüm" diye işaretlenip "eşitlik sırası"na (bölüm 3'ün sonu) girer. Mağaza kuralının yasakladığı satış yönlendirmeleri de silinmez: site onları `?app=android` modunda gizler (bölüm 8).

---

## 1. Amaç ve kapsam

- StudyMode'un **native Android uygulaması**: Kotlin + Jetpack Compose. Web görünümüne sarılmış site değil (yalnızca bot doğrulaması için küçük bir web görünümü var, bkz. bölüm 6).
- **Yeni sunucu yok.** Uygulama sitenin kullandığı her şeyi aynen kullanır:
  - Aynı Supabase projesi (`https://jpcatyopkpnudgdyncas.supabase.co`, sitedeki *publishable* anahtar; bu anahtar zaten herkese açık, veriyi satır güvenliği korur).
  - Aynı yapay zekâ ucu: `POST https://studymode.fun/api/generate` (kullanıcının kendi oturum jetonuyla; model seçimi ve günlük kota sunucuda).
  - Aynı hesap silme ucu: `POST https://studymode.fun/api/delete-account`.
- Paket adı: **`fun.studymode.app`** (iOS'taki bundle ID ile aynı).
- **İlk sürümün kapsamı iPhone'un ilk sürümüyle aynı** (bölüm 3'teki tablo, iOS'taki ✅ adımların karşılığı). Satış yok (bölüm 8).
- Kural: Android uygulaması sitenin verisini **sitenin yazdığı şekilde** yazar. Bir telefonda yapılan çalışma sitede ve iPhone'da aynen görünür; hiçbir alanı bozmaz (bölüm 5).

## 2. Mimari

**MVVM + sade katmanlar (data / domain / ui).** Abartı yok: her ekranın bir `ViewModel`'i, verinin bir `Repository`'si, sitenin kurallarının (SRS, günlük tekrar, sınav hazırlığı) saf Kotlin karşılıkları.

- **ui:** Compose ekranları + `ViewModel` (ekran durumu `StateFlow` ile). Ekranlar veritabanını bilmez.
- **domain:** sitenin `src/lib/*.ts` kurallarının birebir Kotlin karşılığı, Android'e bağımlı değil (saf fonksiyon). Birim testleri buraya yazılır ve sitenin test örnekleri (`srs.test.ts`, `dailyReview.test.ts`, `mathPages.test.ts`…) aynen taşınır.
- **data:** Supabase (supabase-kt), `/api/generate` istemcisi (Ktor), cihazda tutulan ayarlar (DataStore), dosya okuma (PDF, Office, fotoğraf).
- Ayrı "use case" sınıfları yalnızca gerçekten birden çok ekranın paylaştığı işlerde (ör. "kartı cevapla" = SRS + kart yazımı + `bump_study_day`).

Örnek paket ağacı (`android/app/src/main/java/fun/studymode/app/`):

```
fun.studymode.app
├── StudyModeApp.kt            // Application: AppContainer'ı kurar
├── MainActivity.kt            // tek Activity, Compose + Navigation
├── AppContainer.kt            // elle bağımlılık kurulumu (aşağıda)
├── Config.kt                  // Supabase URL, publishable anahtar, site adresi, Turnstile site key, Google web client ID (hepsi herkese açık)
├── data
│   ├── supabase/              // SupabaseClient kurulumu, tablo satırları (Row sınıfları)
│   ├── repo/                  // CoursesRepo, NotesRepo, CardsRepo, StudyDaysRepo, ExamsRepo, AccountRepo
│   ├── ai/                    // AiClient (/api/generate), görev girdileri/çıktıları
│   ├── files/                 // PdfText, PdfPages (resme çevirme), OfficeText, ImageScale
│   └── prefs/                 // DataStore: günlük hedef, tema, "Biraz daha", tanıtım görüldü mü
├── domain
│   ├── Srs.kt                 // srs.ts birebir
│   ├── DailyReview.kt         // dailyReview.ts birebir
│   ├── CourseExams.kt         // courseExams.ts (examDateForCard, upcomingExams…)
│   ├── ExamFocus.kt           // examFocus.ts (examReadiness, pickExamFocus)
│   ├── MathPages.kt           // mathPages.ts birebir
│   ├── LocalDay.kt            // streak.ts localDayKey
│   └── LatexText.kt           // LaTeX → Unicode (iOS'taki gibi)
└── ui
    ├── theme/                 // "Fosforlu" renkler, yazı tipleri
    ├── auth/                  // giriş, kayıt, şifre sıfırlama, Turnstile web görünümü
    ├── onboarding/
    ├── courses/  notes/  addnote/  summary/  cards/  review/  quiz/  exams/  fosfor/  account/
    └── components/
```

**Hilt mi, elle bağımlılık mı? → Öneri: elle (`AppContainer`).**
- Uygulama tek modül, tek Activity, bağımlılık sayısı az (bir Supabase istemcisi, bir yapay zekâ istemcisi, birkaç repo). Elle kurmak 40-50 satır.
- Hilt; Gradle'a ek eklenti, kod üretimi (KSP/kapt) ve not ekleri getirir. Derleme hatası çıktığında mesajları teknik olmayan biri için çok karışık; sürüm uyumsuzluğu sık görülen bir derleme kırığı.
- `ViewModel`'ler `viewModelFactory { initializer { … } }` ile `AppContainer`'dan beslenir; bu, Android'in resmî ve yeterli yolu.
- Uygulama büyür, test için sahte repo değiştirmek zorlaşırsa Hilt sonradan eklenebilir; taşınması mekanik bir iş.

## 3. Ekranlar ve adım tablosu

Sıra iPhone'daki sırayla aynı. Her adımın "bitti" tanımı: **emülatörde derleniyor + kendi testleri geçiyor + aşağıdaki somut koşul**. "Giriş yapılmış ekranda görüldü" ayrıca yazılır (iOS'taki gibi).

| | Adım (iOS karşılığı) | "Bitti" demek için |
|---|---|---|
| 0 | **Proje iskeleti:** `android/` altında Gradle projesi, paket `fun.studymode.app`, Compose, Navigation, tema, `AppContainer`, `Config` | Android Studio'da açılıyor, emülatörde boş "StudyMode" ekranı açılıyor; `./gradlew test` geçiyor |
| 1 | **Giriş / kayıt / şifre sıfırlama** (iOS 1): e-posta + şifre, Turnstile görünmez web görünümünden `captchaToken`, şifre sıfırlama e-postası (bağlantı sitenin `/sifre-yenile` sayfasına gider, şifre sitede yenilenir), oturum açık kalır, çıkış | Gerçek hesapla giriş/çıkış; yeni hesap açma; sıfırlama e-postası geliyor; uygulama kapanıp açılınca oturum duruyor |
| 1b | **Google ile giriş** (Credential Manager, bölüm 7) | Emülatörde (Google Play'li sistem görüntüsü) ve telefonda Google hesabıyla giriş; sitedeki aynı hesap açılıyor |
| 1c | **Açılış akışı** (iOS "Açılış akışı"): 3 tanıtım sahnesi, "Seni tanıyalım" (`user_metadata.education`, v2), sonra giriş; Turnstile arka planda | İlk açılışta tanıtım, sonra kayıt; seçilen seviye hesaba yazılıyor ve site tekrar sormuyor |
| 2 | **Dersler ve not listesi** (iOS 2): "Çalışma masam", dersler, ders içi notlar (salt okuma) | Sitedeki dersler ve notlar aynı sırada görünüyor |
| 3 | **Özet** (iOS 3): kavramlar, ana noktalar, tam özet; LaTeX → Unicode; "Devam: Ana noktalar" → `tanis`, "Kartlarla pekiştir" → `anla` | Özet sitedekiyle aynı; adım işaretlenince sitede de işaretli; `summary`'nin diğer alanları değişmemiş (bkz. 5.3) |
| 4 | **Kartlar ve Tekrar** (iOS 4 + "Yeni Tekrar"): `srs.ts` birebir, dört değerlendirme, günlük hedef 15, günde en fazla 5 yeni, sıra, "Bugün tamam" + "Biraz daha", ders bazında hazırlık, kart çevirme ve kaydırma | Kotlin SRS'si sitenin `srs.test.ts` örneklerinin hepsini geçiyor; telefonda 3 kart cevaplanınca sitedeki "Bugünkü hedef" 3 artıyor; `study_days` yalnızca RPC ile |
| 5 | **Test** (iOS 5): sorular, "Kontrol et" + açıklama, sonuç, yanlışlar, tekrar çöz, yanlışları karta çevir; `quiz_attempts`, `bump_study_day(p_quizzes)`, `sina` adımı | Test sonucu sitede "son sonuç" olarak görünüyor; yeni kart kuyruğu bu notu "hazır" sayıyor |
| 6 | **Not ekleme** (iOS 6): metin, fotoğraf (kamera / galeri / ML Kit belge tarayıcı → `transcribe`), PDF (metin + taranmış sayfa → `transcribe`), yeni ders ekleme; not önce kaydedilir, sonra `study` ile 12.000 karakterlik parçalar, aynı anda 3, zaman aşımında yarıya bölme; "Şimdi hazırla" | Gerçek bir defter fotoğrafı ve bir PDF'ten not hazırlanıyor; site aynı notu aynı şekilde gösteriyor |
| 6b | **Formüllü PDF sayfaları** (iOS "MathPages"): `mathPages.ts` kuralları birebir, seçilen sayfalar resme çevrilip `transcribe` ile okunur, sıra korunur | Sitenin `mathPages.test.ts` örnekleri Kotlin'de geçiyor; matematik PDF'inde formüller düzgün |
| 6c | **Office dosyaları** (iOS "Not ekle → Dosya"): .pptx, .docx, .xlsx, .txt/.md; sitenin `officeText.ts` kuralları; Android'in "Paylaş" menüsünden dosya alma | Bir sunum ve bir Word dosyası not oluyor; metin sitedeki çıktıyla aynı |
| 7 | **Sınavlar** (iOS "Sınavlar sekmesi"): sınav takvimi, `course_exams` ekle/düzenle/sil, `courses.exam_date` eşitleme, sınav notu girme, Sınav Provası (`exam` + `grade` görevleri, `exam_results`) | Sitede eklenen sınav telefonda, telefonda eklenen sitede; prova sonucu sitede listede |
| 8 | **Bugün + Anlat** (iOS "Bugün", Adım 5 "Anlat"): selam, geri sayım, "Şimdi bununla başla", 7 gün şeridi, akıllı plan; açık uçlu sorular, `grade`, `notes.practice` (yalnızca `draft`/`evaluation`) | Sitedeki "Bugün" ile aynı öneriyi gösteriyor; yazılan cevap sitede görünüyor |
| 9 | **Not ve ders menüleri** (iOS): kaynak metin, notu düzenle, yeniden hazırla, paylaş, sil (sınavların `note_ids`'inden çıkar); "Bu konuyu anlamadım" (`explain`); "Ayrıntılı özet hazırla" (`detail`); dersi düzenle/paylaş (`course_shares`)/sil; paylaşılan dersi ekle | Her işlem sonrası site aynı durumu gösteriyor; silinen not sınav kapsamından da çıkmış |
| 10 | **Fosfor asistanı** (iOS "Fosfor"): kendi sekmesi, `chat` görevi, sitenin `assistant.ts` bağlam kuralları (açık not 9.000, diğerleri 2.500, toplam 16.000), "Karta çevir"; ekranda tek Fosfor kuralı | Nottan soru sorulup cevap alınıyor; "Karta çevir" kartı sitede görünüyor |
| 11 | **Hesap ve ayarlar** (iOS "Ayarlar", "Başarımlar"): günlük kart hedefi (1-500, varsayılan 15), okul seviyesi, tema, geri bildirim (`public.feedback`), hakkında (gizlilik, koşullar); başarımlar ve seviye (`achievements.ts`, `xp.ts`) | Ayar değişince Tekrar yeni hedefi kullanıyor; geri bildirim tabloya düşüyor |
| 12 | **Hesap silme** (iOS "Hesap silme"; Google Play şartı): "SİL" onayı, Premium uyarısı (`409 premium_active` → `premium_ok:true`), başarıda yerel çıkış | Yalnızca **atılabilir test hesabıyla** denenir; hesap ve verisi gidiyor |
| 12b | **"Cevabı bildir"** (Google Play üretken yapay zekâ kuralı, bölüm 9): not hazırlama sonucu, özet / ayrıntılı özet, "Bu konuyu anlamadım" açıklaması, Anlat ve Sınav Provası değerlendirmeleri ve Fosfor cevaplarının yanında küçük bir "Cevabı bildir" düğmesi. Kısa bir form açılır (neden + isteğe bağlı açıklama) ve `public.feedback`'e bir satır yazılır (bölüm 5.1) | Her ilgili ekranda düğme var; gönderilen bildirim `feedback` tablosunda görünüyor ve kısıtlara uyuyor (`message` 3-2000, `page` ≤ 200, `device` ≤ 300). **İlk sürüm için şart** (kapalı testten önce) |
| 13 | **Mola + Çalışma fişi**: **sonraki sürüm** (kullanıcı kararı, ilk sürüme girmeyecek). Eşleştir, Hızlı tur, odak sayacı (`mola.ts`); fiş (`receipt.ts` gizlilik kuralları) | iOS'takiyle aynı kurallar. İlk sürümden sonra, eşitlik sırasının başında |
| 14 | **Toparlama:** hata mesajları, boş ekranlar, karanlık tema, büyük yazı, TalkBack (ekran okuyucu), uygulama simgesi, çevrimdışı uyarısı | Kalite kontrolün listesi temiz |
| 15 | **Mağaza hazırlığı:** imzalı yayın paketi (AAB), Data safety formu, gizlilik ve hesap silme bağlantıları, kapalı test (bölüm 9) | Kapalı test yayında, testçiler indirebiliyor |

Uygulamada **olmayacaklar** (Android'de yasak ya da yalnızca yöneticiye ait): Premium satışı, Premium kodu girme, Shopier bağlantısı (Play Billing kuralı, bölüm 8) ve yönetici ekranları. Bunlar sitede kalır. Uygulamanın açtığı site sayfaları `?app=android` ile açılır, site bu modda satış bağlantılarını gizler (bölüm 8).

**İlk sürümden sonra eşitlik sırası** (temel kural gereği sitede olan her şey uygulamaya gelir; sıra yaklaşık):
1. Mola + Çalışma fişi (adım 13).
2. Premium araçları: sesli not, akıllı arama, görseller. Satış olmadan gelir: sitede Premium almış hesapta açılır (bölüm 8).
3. Mini oyunlar (sitedeki VIP mini oyunları dahil).
4. Sınav provasının ilk sürüme girmeyen parçaları (varsa, adım 7 yapılırken listelenir).
5. Sitede olup uygulamada henüz olmayan her şey (ör. kendi yapay zekâ anahtarı). Liste her sürümde site ile karşılaştırılıp güncellenir.

## 4. Kütüphaneler

Sürümler: **Android Studio'nun önerdiği güncel kararlı sürüm** (proje açılınca Studio'nun "yeni sürüm var" uyarılarına göre). Burada sabit sürüm numarası bilerek yazılmadı. Sürümler tek yerde, `gradle/libs.versions.toml` dosyasında tutulur.

| Kütüphane | Ne için |
|---|---|
| **Jetpack Compose** (BOM ile) + Material 3 | Ekranlar |
| **Navigation Compose** | Ekranlar arası geçiş, notu doğru adımda açma (iOS `NoteRoute` karşılığı) |
| **Lifecycle ViewModel Compose** | ViewModel'ler |
| **supabase-kt** (`auth-kt`, `postgrest-kt`; gerekirse `functions-kt`) | Giriş, oturum, tablolar, `bump_study_day` / `ai_quota` RPC. Sitenin "Edge Function"ı yok; `functions-kt` muhtemelen gerekmez |
| **Ktor client** (OkHttp ya da Android motoru) | supabase-kt'nin kendisi kullanıyor; `/api/generate` ve `/api/delete-account` çağrıları da bununla |
| **kotlinx.serialization** | JSON. Ayrıca `summary` ham `JsonObject`, `practice` ve `questions` ham `JsonArray` olarak tutulur (bkz. 5.3) |
| **Coil** | Fotoğraf önizlemeleri, küçük resimler |
| **ML Kit Document Scanner** (Google Play services) | "Defteri tara": çok sayfalı belge yakalama, kenar düzeltme. Kamera izni bile istemez |
| **CameraX** | Yalnızca belge tarayıcı yetmezse (ör. Google Play services olmayan cihaz) tek fotoğraf çekmek için; büyük ihtimalle gerekmez, sistemin kamera uygulaması (`TakePicture`) yeter |
| **Android Photo Picker** (`PickVisualMedia`) | Galeriden fotoğraf; izin gerektirmez |
| **PdfRenderer** (Android'in kendi içinde) | PDF sayfasını resme çevirme (taranmış sayfalar ve formüllü sayfalar → `transcribe`) |
| **PdfBox-Android** | PDF'ten **metin** çıkarma. Android'in kendi PDF aracı metin vermiyor; bu kütüphane gerekli (lisansı Apache 2.0). Sayfa başına resim sayısı (`mathPages`'teki `figures`) de bununla sayılır |
| **Credential Manager** + `googleid` | Google ile giriş (bölüm 7) |
| **DataStore (Preferences)** | Günlük hedef, tema, "Biraz daha", tanıtım görüldü mü, Mola rekorları |
| **WorkManager** | Gerekirse: uzun not hazırlığını uygulama arka plana atılınca da sürdürmek, odak sayacı bildirimleri. İlk adımlarda yok |
| **WebView** (Android'in kendi içinde) | Yalnızca Turnstile (bölüm 6) |
| Office dosyaları | Ek kütüphane yok: .docx/.pptx/.xlsx aslında zip içinde XML; Android'in `java.util.zip` + `XmlPullParser`'ı yeter |
| Test | JUnit (domain testleri), Compose UI testleri sonra |

## 5. Veri kuralları (sitenin verisini bozmamak için)

Kaynak dosyalar (salt okuma, sitenin kodu): `src/lib/types.ts`, `src/lib/srs.ts`, `src/lib/dailyReview.ts`, `src/lib/courseExams.ts`, `src/lib/examFocus.ts`, `src/lib/streak.ts`, `src/lib/mathPages.ts`, `src/lib/officeText.ts`, `src/lib/ai/index.ts`, `src/lib/ai/tasks.ts`, `supabase/schema.sql`. iOS'taki birebir karşılıklar da örnek olarak okunur (`ios/StudyMode/Data/`, `SRS.swift`, `StudyDays.swift`, `AI/MathPages.swift`).

### 5.1 Tablolar ve sütunlar (`supabase/schema.sql`, `types.ts`)

Bütün tablolarda satır güvenliği açık: herkes yalnızca kendi satırını görür. `user_id` varsayılanı `auth.uid()`; uygulama göndermese de olur.

| Tablo | Sütunlar (veritabanı adıyla) | Not |
|---|---|---|
| `courses` | `id, name (1-120), color, exam_date (date), created_at, updated_at` | `exam_date` en yakın gelecek `course_exams` tarihini takip eder (sitedeki `store.tsx` gibi eşitlenir) |
| `notes` | `id, course_id, title (1-200), content (≤ 400.000), summary (jsonb nesne), questions (jsonb dizi, varsayılan '[]'), practice (jsonb dizi, varsayılan '[]'), generator ('ai'/'local'), created_at, updated_at` | `summary` ham `JsonObject`, `questions` ve `practice` ham `JsonArray` olarak korunur (5.3) |
| `cards` | `id, course_id, note_id (boş olabilir), front, back, source, due, "interval", ease, reps, lapses, created_at, updated_at` | `interval` tırnaklı sütun adı (SQL'de ayrılmış kelime) |
| `quiz_attempts` | `id, course_id, note_id, score (≥0), total (>0, score ≤ total), wrong_ids (jsonb), answers (jsonb, isteğe bağlı), created_at` | |
| `exam_results` | `id, course_id, format, difficulty, source, note_ids, questions, answers, scores, feedback, score, total, duration_seconds, created_at` | Sınav Provası |
| `study_days` | `id, day ('YYYY-MM-DD'), reviews, quizzes, actions, new_cards, …` | **Asla doğrudan yazılmaz**, yalnızca RPC (5.4). `(user_id, day)` tekil |
| `course_exams` | `id, course_id, kind (vize/final/butunleme/quiz/diger), title, "date", "time" (isteğe bağlı, HH:MM), weight, grade (isteğe bağlı), note_ids, …` | `time`/`grade` eski veritabanında olmayabilir; iOS'taki gibi güvenli yazılır |
| `course_shares` | `id (varsayılan gen_random_uuid()), user_id, course_id, token (16-64 harf/rakam, tekil), title (1-120), owner_name (≤ 80), snapshot (jsonb, ≤ 3 MB), created_at, updated_at` | Ders paylaşımı (adım 9), sitenin `share.ts` kurallarıyla |
| `feedback` | `id (varsayılan gen_random_uuid()), user_id (varsayılan auth.uid()), kind ('fikir' / 'hata' / 'diger'), message (3-2000), contact (≤ 120, isteğe bağlı), page (≤ 200), device (≤ 300), created_at` | Geri bildirim (adım 11) ve "Cevabı bildir" (adım 12b). Uygulama bu tabloya yalnızca `insert` yapar |

- **Kimlikler:** `courses`, `notes`, `cards`, `quiz_attempts`, `exam_results` ve `course_exams` satırlarının kimliğini uygulama üretir (`UUID.randomUUID()`, site de istemcide üretiyor). `course_shares` ve `feedback` tablolarında (`client_errors`'ta da) `id default gen_random_uuid()` var: bunlarda kimlik gönderilmez, veritabanı üretir. `supabase/schema.sql` ile doğrulandı.
- **"Cevabı bildir" satırı** (`feedback`, adım 12b):
  - `kind = 'hata'`.
  - `message` = `[YZ cevabı] <neden>: <kullanıcının açıklaması>`, ardından `--` satırı ve cevabın ilk ~1.500 karakteri. Toplam 2.000 karaktere kırpılır, en az 3 karakter olur.
  - `page` = `android:<ekran>/<not ya da ders kimliği>` (ör. `android:summary/<noteId>`, `android:fosfor`), 200 karaktere kırpılır.
  - `device` = `Android <sürüm> · <marka model> · uygulama <sürüm>`, 300 karaktere kırpılır.
  - `contact` boş kalır.
  - Ayrı bir `kind` değeri (ör. `'yz'`) şema değişikliği demek, yani site işi. O gelene kadar `'hata'` + `[YZ cevabı]` öneki kullanılır.
- Tarihler ISO 8601, UTC, milisaniyeli (`2026-11-27T10:15:00.000Z`), JavaScript'in `toISOString()` biçimi.
- RPC'ler: `bump_study_day`, `ai_quota()` (kota ve `premium_until` okumak için, salt okuma).
- Hesap bilgisi: `user_metadata.education` (`{ level, school, department, classYear, …, v: 2, at }`), `user_metadata.achievements`. Yazarken var olan diğer alanlar korunur (yalnızca değişen anahtar güncellenir).

### 5.2 Tekrar zamanlaması: `srs.ts` birebir

- `schedule(card, grade, now, examDate)`, **Bilemedim** dalı: 10 dk sonra, `interval 0`, `ease = max(1.3, ease − 0.2)` **yuvarlanmadan**, `reps 0`, `reps > 0` ise `lapses + 1`. Bu dal `srs.ts` 35-43. satırlarda erken döner: aşağıdaki 0,01 yuvarlamasından ve sınav sınırından geçmez. Bu yüzden kayan nokta artığı olduğu gibi yazılır (ör. 2.3 − 0.2 = 2.0999999999999996). Kotlin'de de bu dalda yuvarlama yapılmaz.
- **Zor / İyi / Kolay** dalları: formüller, sınav varken aralığın `max(1, floor(kalan gün / 2))` ile sınırlanması, ardından yalnızca bu üç dalda `interval`'ın 0,1'e, `ease`'in 0,01'e yuvarlanması, `due = now + round(interval) gün`.
- **Yuvarlama tuzağı:** JavaScript'in `Math.round` ve Java'nın `Math.round` yarımı yukarı yuvarlar (2.5 → 3). Kotlin'in `kotlin.math.round` ise yarımı çifte yuvarlar (2.5 → 2). Kotlin'de **`kotlin.math.round` kullanılmaz**; `Math.round` (Java) kullanılır. Testle korunur.
- `daysUntil`: cihazın **yerel** günleriyle (`LocalDate`), site gibi.
- Yalnızca değişen sütunlar yazılır: tekrar sonrası kartta **yalnızca** `due, interval, ease, reps, lapses, updated_at` (iOS ile aynı). `front`/`back` gibi alanlar geri yazılmaz.
- Sitenin `srs.test.ts` örnekleri Kotlin testine birebir taşınır.

### 5.3 Notların JSON alanları

- `notes.summary` ham JSON (`JsonObject`) olarak okunur. Uygulama yalnızca dokunduğu anahtarı değiştirir (`completedSteps`'e adım ekleme, `detailed`, `sourceChanged`), **diğer bütün alanları aynen geri yazar**.
  - **Kritik:** `summary`'yi bir Kotlin `data class`'ına çevirip geri yazmak, uygulamanın bilmediği alanları (`mnemonics`, `comparisons`, `checkedTerms`, `tags`, ileride eklenecekler) **siler**. Okumak için sınıf kullanılabilir; yazmak için hep ham JSON.
- `notes.practice` bir **dizidir** (`jsonb not null default '[]'`, `types.ts`'te `PracticeItem[]`) ve ham `JsonArray` olarak okunur. Anlat'ta bir cevap yazılınca **yalnızca o öğenin** (`id` ile bulunur) `draft` ve `evaluation` alanları değişir. O öğenin diğer alanları (`id`, `question`, `answer`, `hint` ve bilinmeyenler) ile dizideki diğer bütün öğeler **ham hâliyle, sırası bozulmadan** geri yazılır. Sitenin `store.tsx`'i de böyle yapıyor (`{ ...p, ...patch }`). Dizi bir Kotlin listesine çevrilip yeniden kurulmaz.
- `notes.questions` da bir **dizidir** (`jsonb not null default '[]'`, `Question[]`) ve ham `JsonArray` olarak okunur. Uygulama bu alanı **yalnızca not hazırlanırken** yazar (`study` görevinin sonucu, "yeniden hazırla" dahil). Site de yalnızca burada ve paylaşılan dersi eklerken oluşan yeni notta yazıyor. Test çözmek ya da yanlışları karta çevirmek `questions`'a dokunmaz; sonuçlar `quiz_attempts`'e gider.
- `completedSteps` değerleri: `tanis`, `anla`, `pekistir`, `sina`, `anlat`. Ekleme, var olanı silmeden ve tekrar etmeden.
- **LaTeX kaçışı:** Modeller JSON içine `\sqrt`, `\in` gibi tek ters eğik çizgiyle LaTeX yazıyor. Sunucu bunu `repairLatexEscapes` (`src/lib/ai/tasks.ts`) ile onarıp geçerli JSON döndürüyor; yani uygulamaya gelen `/api/generate` cevabı zaten geçerli JSON. Uygulamanın kuralı: **JSON'u asla elle metin birleştirerek kurmamak**, her zaman kotlinx.serialization ile kodlamak (ters eğik çizgi doğru kaçar). Kotlin testlerinde de `"\\frac"` gibi yazmaya dikkat. Yapay zekânın ham metnini uygulama kendisi ayrıştırırsa (şu an yok) aynı onarım uygulanmalı.

### 5.4 `study_days` yalnızca `bump_study_day` ile

- Çağrı: `rpc("bump_study_day", { p_day, p_reviews, p_quizzes, p_actions, p_new_cards })` (gönderilmeyen alan 0).
- Gün = cihazın yerel günü `YYYY-MM-DD` (`streak.ts` `localDayKey` ile aynı).
- Kart cevabı: `p_reviews = 1`; kart yeniyse (cevaptan önce `reps 0, lapses 0, ease 2.5`) ayrıca `p_new_cards = 1`.
- Test ve sınav provası bitişi: `p_quizzes = 1`. Anlat cevabı ve diğer çalışma: `p_actions = 1`.
- Geri alma eklenirse negatif değer (`p_reviews = -1`, yeniyse `p_new_cards = -1`).
- Dönen satır bütün cihazların toplamıdır; ekrandaki bugünkü sayı bununla güncellenir.
- `study_days`'e **insert / upsert / update yok.**

### 5.5 Günlük tekrar: `dailyReview.ts` birebir

- Hedef = Ayarlar'daki günlük kart hedefi (varsayılan **15**; kayıtlı eski 20 de 15 sayılır). "Biraz daha" **+10** (cihazda, yalnızca bugün için).
- Bugünkü ilerleme = `study_days.reviews` (bugünün satırı). Günde en fazla **5 yeni** kart (`MAX_NEW_PER_DAY`), sayaç `study_days.new_cards`.
- Yeni kart = `reps 0 && lapses 0 && ease 2.5`. Bilinemeyen = `lapses > 0` ya da (`reps 0` ve yeni değil).
- **Kuyruğa yalnızca zamanı gelmiş kartlar aday olur** (`isDue`: `due <= şimdi`). `dailyReview.ts` 68. satır önce `isDue` ile süzer, sonra sıralar. Zamanı gelmemiş bir kart, yeni olsa bile, "Biraz daha" ile de kuyruğa girmez.
- Yeni kart yalnızca notu "hazır" ise girer: notun `completedSteps`'inde `tanis` ya da `anla` var, **ya da** o nota ait en az bir `quiz_attempts` satırı var, **ya da** kartın notu yok / notu silinmiş. Bir kez cevaplanmış kart, notu ne durumda olursa olsun zamanı gelince gelir.
- Sıra: (a) en yakın sınavı olan dersin kartları (sınavsız en sona; `examDateForCard`), (b) bilinemeyenler önce, (c) en çok gecikmiş (`due` en eski), (d) en sonda yeni kartlar (5 sınırıyla). Oturum hedefte durur.
- Ekranda **toplam kart sayısı yok**; "Bugünkü hedef x/15" ve ders bazında hazırlık (`examReadiness`). "Bilemedim" denen kart oturumun sonuna döner.
- Sitenin `dailyReview.test.ts` örnekleri Kotlin'e taşınır.

### 5.6 Test ve not hazırlama

- Test bitince: `quiz_attempts` satırı (`score, total, wrong_ids, answers`), `bump_study_day(p_quizzes = 1)`, `completedSteps`'e `sina`.
- Not önce kaydedilir, sonra hazırlanır (`study` görevi): 12.000 karakterlik parçalar, aynı anda 3, zaman aşımında parça ikiye bölünüp yeniden denenir (sitenin `src/lib/ai/index.ts` ve `mergeNotes.ts` kuralları; iOS bunu sitenin koduyla karşılaştırdı, aynısı yapılır).
- Notu silerken sınavların `note_ids` listesinden de çıkarılır; kartlar ve test sonuçları veritabanında kendiliğinden (cascade) gider.

### 5.7 Formüllü PDF sayfaları: `mathPages.ts` kuralı

- Her sayfanın metni çıkarılır. `pagesToReadAsPictures(texts, figures)` hangi sayfaların **resim olarak** okunacağını söyler: metni olmayan (taranmış) sayfalar; formülü bozulmuş sayfalar (`looksLikeBrokenMath`: ¥¢¤¡ gibi bozuk harfler, kesir artığı kısa satırlar, düşmüş üsler, yoğun sembol); matematik ağırlıklı belgede (metinli sayfaların en az %30'u) logodan fazla resmi olan sayfalar.
- Bu sayfalar `PdfRenderer` ile resme çevrilir, `transcribe` ile okunur; sayfa sırası korunur, iki sayfa yalnızca art arda ise tek istekte gider, okunamayan sayfa kendi metnini korur (iOS ile aynı).
- Matematik ağırlıklı belgede `fixSymbolFont` (¥¢¤¡ → ℕℤℚℝ) uygulanır.
- Satırlar karakter konumundan bölünür (PDF kütüphanesi bazen bütün sayfayı tek satır verir); sitenin `mathPages.test.ts` örnekleri Kotlin'de de geçmeli.

### 5.8 "Sitenin verisini bozmama" kontrol listesi (her adımdan önce)

- [ ] Yazılan her sütun `schema.sql`'de var ve kısıtlarına uyuyor (uzunluk, aralık, `score ≤ total`).
- [ ] Yalnızca değişen sütunlar yazılıyor (özellikle `cards`).
- [ ] `summary` (`JsonObject`) ve `practice` (`JsonArray`) ham JSON olarak okunup geri yazılıyor ve bilinmeyen alanlar duruyor. `practice`'te yalnızca değişen öğenin `draft`/`evaluation`'ı değişiyor. `questions`'a yalnızca not hazırlanırken yazılıyor.
- [ ] `study_days`'e doğrudan yazma yok; yalnızca `bump_study_day`.
- [ ] Gün hesabı cihazın yerel günü; tarih biçimi `toISOString()` ile aynı.
- [ ] SRS ve günlük kuyruk sitenin test örneklerini birebir geçiyor (yuvarlama dahil).
- [ ] Yeni kart tanımı (`reps 0, lapses 0, ease 2.5`) ve `p_new_cards` doğru.
- [ ] `completedSteps`'e ekleme var olanı silmiyor, tekrar etmiyor.
- [ ] Not silinince sınavların `note_ids`'i temizleniyor; ders adı çakışırsa site kuralı (ör. "(paylaşılan)").
- [ ] `user_metadata` yazarken diğer anahtarlar korunuyor.
- [ ] JSON hiçbir yerde elle birleştirilmiyor.
- [ ] Silme işlemleri (not, ders, hesap) yalnızca kullanıcı onayıyla ve hesap silme yalnızca test hesabında denendi.
- [ ] Değişiklik sitede açık sekmeyle birlikte denendi (site 2 dakikadan uzun açık kalan sekmeyi dönüşte yeniden okur).

## 6. Turnstile (bot doğrulaması)

Supabase'de Cloudflare Turnstile açık: giriş, kayıt ve şifre sıfırlamada tek kullanımlık bir jeton (`captchaToken`) şart. Turnstile yalnızca sitenin alan adında çalıştığı için iPhone'daki çözümün Android karşılığı yapılır (`ios/StudyMode/Auth/Turnstile.swift`):

- Uygulamada **tek bir `WebView`**, uygulama açılınca arka planda başlar. Sayfa `loadDataWithBaseURL("https://studymode.fun", html, "text/html", "utf-8", null)` ile yüklenir; böylece sayfanın adresi studymode.fun olur. **Sitede değişiklik gerekmez.**
- İçindeki küçük HTML, Cloudflare'in `api.js`'ini açar ve widget'ı `appearance: 'interaction-only'`, `language: 'tr'`, site anahtarı `Config.TURNSTILE_SITE_KEY` (sitedekiyle aynı, herkese açık) ile çizer. Cloudflare dokunuş istemezse kullanıcı hiçbir şey görmez.
- Jeton, `addJavascriptInterface` ile tanımlanan küçük bir köprüyle (`Android.post(...)`) Kotlin'e gelir: `token`, `expired`, `error`, `interactive` (Cloudflare dokunuş istiyor → kayıt kartında kutu görünür), `interactive-done`.
- Jeton tek kullanımlık ve ~5 dakika geçerli: her istekte `take()` ile alınır, ardından `turnstile.reset('#cf')` yeni jeton ister; süresi dolunca sessizce yenilenir.
- Jeton supabase-kt'ye **`captchaToken`** olarak verilir: e-posta ile giriş, kayıt, şifre sıfırlama e-postası ve Google ile giriş (`signInWith(IDToken)`). supabase-kt'de alanın tam yeri (çağrının parametresi mi, ayar bloğu mu) kodlanırken kütüphanenin güncel belgesinden doğrulanacak.
- Cloudflare Managed modda kalıyor (kullanıcı kararı, IOS_SYNC madde 7); kutu bazen çıkabilir, kimse kilitli kalmaz.
- **Android'e özel risk:** Android WebView'ın tarayıcı kimliğinde `; wv` işareti var; Cloudflare bunu daha sık kutuyla karşılayabilir. iOS'ta Safari'nin kimlik sonu eklenmişti. Android'de önce kimliğe dokunmadan denenir; kutu çok sık çıkarsa kimlikten yalnızca `; wv` çıkarılıp yeniden denenir (Cloudflare'in kurallarına aykırı bir şey değil ama emin olmadan ilk sürüme konmaz).
- WebView'da yalnızca JavaScript açık; dosya erişimi, başka adrese gitme kapalı (yalnızca `challenges.cloudflare.com` ve `studymode.fun`).

## 7. Google ile giriş (Android istemcisi)

Yol: Android'in **Credential Manager**'ı Google'dan bir **kimlik belirteci** (ID token) alır, uygulama bunu Supabase'e `signInWith(IDToken) { provider = Google; idToken; nonce }` + `captchaToken` ile verir. Sitedeki Google girişiyle aynı mantık (`src/lib/googleSignIn.ts`): rastgele bir *nonce* üretilir, Google'a SHA-256'sı, Supabase'e kendisi gider.

**Kullanıcının yapacakları (bir kez, tıklama tıklama):**

1. Tarayıcıda **https://console.cloud.google.com** → üstteki proje seçiciden **proje numarası 189951485932** olan projeyi seç (sitenin ve iPhone'un Google girişinin olduğu proje).
2. Sol menü → **APIs & Services** → **Credentials**.
3. Üstte **+ Create credentials** → **OAuth client ID**.
4. **Application type:** **Android**.
5. **Name:** `StudyMode Android (debug)`.
6. **Package name:** `fun.studymode.app`.
7. **SHA-1 certificate fingerprint:** bilgisayarındaki geliştirme anahtarının parmak izi. İki yoldan biri:
   - Terminal'de (Android Studio kurulduktan ve bir kez uygulama derlendikten sonra):
     ```
     keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
     ```
     Çıktıdaki `SHA1:` satırını kopyala. (Bu şifreler Android'in herkese açık varsayılan geliştirme şifresi, gizli değil.)
   - Ya da Android Studio'da sağdaki **Gradle** paneli → `app` → `Tasks` → `android` → **signingReport**'a çift tıkla; alttaki çıktıda `Variant: debug` altındaki `SHA1`.
8. **Create**. Çıkan Android Client ID'yi uygulamaya koymaya **gerek yok** (Credential Manager onu paket adı + parmak izinden kendisi bulur); yalnızca Google'da kayıtlı olması yeter.
9. **Yayın için ikinci bir Android istemcisi:** Uygulama Play'e yüklendikten sonra **Play Console** → uygulama → **Test and release → App integrity** (ya da **Setup → App signing**) → **App signing key certificate** altındaki **SHA-1**'i kopyala. Aynı 3-8 adımlarını tekrarla, adı `StudyMode Android (Play)`, aynı paket adı, bu SHA-1. (İstersen "Upload key certificate" SHA-1'i için de bir tane; yalnızca kendi yüklediğin paketi telefona doğrudan kuracaksan gerekir.)

**Uygulamanın kullandığı kimlik: Web client ID.** Credential Manager'da `GetGoogleIdOption` (ya da "Google ile giriş" düğmesi için `GetSignInWithGoogleOption`) içine **sitenin mevcut web istemcisi** verilir: `189951485932-ginghsotdhaj3amtm0fek00efbgsi7iu.apps.googleusercontent.com` (`src/lib/config.ts` → `GOOGLE_CLIENT_ID`, herkese açık). Google'ın verdiği kimlik belirtecinin "kime" alanı (audience, `aud`) bu web istemcisi olur.

**Supabase'de değişiklik gerekiyor mu? → Büyük ihtimalle hayır.**
- Supabase → Authentication → Providers → Google → **Client IDs** listesinde sitenin web client ID'si zaten var (site aynı yoldan giriyor). Android'in belirteci de bu web ID'si adına çıktığı için Supabase onu tanır.
- Android Client ID'sini bu listeye eklemek gerekmez (iOS'ta gerekmişti, çünkü iOS belirteci iOS istemcisi adına çıkıyor). Zarar da vermez; ilk denemede "audience" hatası alınırsa eklenir.
- "Skip nonce check" **kapalı** kalır.

**Gizli anahtar gerekmez.** Android istemcisinin "client secret"ı yok; uygulamaya, sohbete ya da koda hiçbir gizli değer girmez. Supabase'deki web istemcisinin gizli anahtarı (varsa) olduğu yerde kalır, dokunulmaz.

Not: Google'ın "her girişte e-posta" sorunu (iOS'ta görüldü) Credential Manager'ın kimlik belirteci yolunda beklenmez; site gibi yalnızca ilk girişte gelmesi beklenir. Denenip buraya yazılacak.

## 8. Google Play Billing kararı

- **Şimdilik Android'de satış yok.** Uygulamada Premium satın alma düğmesi, fiyat, "Premium al" yönlendirmesi yok.
- Google'ın kuralı: uygulama içinde dijital bir özellik satılacaksa **Google Play Billing zorunlu**. Uygulamada **Shopier'e, siteye satın almaya ya da Premium koduna yönlendirme yok**: bağlantı, düğme, "sitede daha ucuz" gibi metin de yok. "Premium kodu gir" ekranı da konmaz.
- **Uygulamanın açtığı site sayfaları** (gizlilik, koşullar, hesap silme, şifre yenileme, yardım vb.) her zaman adresin sonuna **`?app=android`** eklenerek açılır; adreste zaten `?` varsa `&app=android`. Site bu modda satış bağlantılarını (Premium al, Shopier, Premium kodu) gizler (bu turda site rolü yapıyor). Kural tek yerde durur, `Config.siteUrl(path)` yardımcısında; adres elle yazılmaz.
- Sitede Premium almış biri uygulamada giriş yaptığında Premium'u sunucu tanır (`/api/generate` kotası hesaba göre); uygulama `ai_quota().premium_until`'i yalnızca "Premium açık" diye gösterebilir. Bunun Google'ın "başka yerde alınmış içeriğe erişim" kuralına uyduğu **Play Console'daki Payments politikasında kontrol edilmeli.**
- İleride satış istenirse gerekenler:
  - Uygulamada Play Billing Library ile abonelik / tek seferlik ürün, satın almada `obfuscatedAccountId` = Supabase kullanıcı kimliği.
  - Sitede yeni sunucu uçları (iOS'taki `/api/apple-purchase` karşılığı): satın alma jetonunu Google Play Developer API ile doğrulama (bir Google Cloud hizmet hesabı gerekir; anahtarı yalnızca Vercel'e girilir), aynı işlemi iki kez saymama (iOS'taki `apple_transactions` gibi bir tablo), `premium_access.until`'i uzatma.
  - **Real-time Developer Notifications (RTDN):** yenileme, iptal, iade bildirimleri Google Cloud Pub/Sub üzerinden sitenin bir ucuna gelir (iOS'taki `/api/apple-notifications` karşılığı). İade edilen süre geri alınır.
  - Satış ve abonelik metinleri, iptal yolu (Play Store → Abonelikler) ve hesap silmede "abonelik kendiliğinden durmaz" uyarısı.

## 9. Google Play hesabı ve kapalı test takvimi

**Hesap:** Kişisel geliştirici hesabı (https://play.google.com/console): **25 USD tek sefer**, kimlik doğrulaması (resmî kimlik ve adres; birkaç gün sürebilir), telefon numarası doğrulaması, ve gerekirse Android cihazla doğrulama (Play Console mobil uygulaması). Hesap adı mağazada görünür.

**Yeni kişisel hesaplarda kapalı test şartı:** Üretime (herkese açık yayına) başvurmadan önce **en az 12 test kullanıcısının kapalı teste katılıp 14 gün kesintisiz katılımda kalması** gerekiyor. Sonra Play Console'dan "üretime erişim" başvurusu yapılır, Google soru formu ister (test nasıl geçti, ne düzeltildi) ve inceleme birkaç gün sürer. *(Sayılar ve süreler zamanla değişti — 20 kişiden 12'ye düştü — başlamadan **Play Console'da kontrol et**.)*

Pratik ipucu: 12 kişi az değil. Arkadaş/sınıf listesi (Gmail adresleri) baştan hazırlanmalı, 14 gün boyunca kimse çıkmamalı; 15-20 kişi davet etmek güvenli.

**Takvim (yaklaşık, gün = takvim günü):**

| Gün | Ne olur | Kim |
|---|---|---|
| Hafta 0 (gün 0-3) | Play Console hesabını aç, 25 USD öde, kimlik doğrulamasını başlat; Android Studio'yu kur (bölüm 10) | Kullanıcı |
| Hafta 0 | Google Cloud'da debug Android istemcisi (bölüm 7) | Kullanıcı |
| Hafta 1-2 (gün 1-14) | Adım 0-6, 12 ve 12b (iskelet, giriş, dersler, özet, Tekrar, test, not ekleme, hesap silme, "Cevabı bildir") | Android Claude'u |
| Gün ~10 | Play Console'da uygulama kaydı (`fun.studymode.app`), mağaza bilgileri taslağı, gizlilik politikası adresi, Data safety, hesap silme adresi (`https://studymode.fun/hesap-sil`), içerik derecelendirme, hedef kitle (yaş; öneri "13 yaş ve üstü"), "uygulama erişimi" (inceleme için test hesabı bilgisi Play Console'a girilir, sohbete değil) | Kullanıcı |
| Gün ~14 | İlk imzalı paket (AAB) → **Closed testing** kanalı; test listesine 15-20 Gmail adresi; katılım bağlantısını paylaş | Kullanıcı (Claude adımları yazar) |
| Gün 14-28 | **14 günlük kapalı test.** Bu sürede adım 7-11 eklenir, testçilere güncellemeler gider (güncelleme göndermek iyi bir işaret sayılıyor) | Claude + testçiler |
| Gün ~29 | Üretime erişim başvurusu (Play Console → Dashboard → "Apply for production") | Kullanıcı |
| Gün ~30-37 | Google incelemesi; onaylanınca üretim sürümü gönderilir, o da incelenir | Google |

**Mağaza için gerekenler:**
- **Data safety formu.** Toplanan veriler:
  - e-posta ve ad;
  - **eğitim bilgisi** (`user_metadata.education`: seviye, **okul ve bölüm**, sınıf), "Seni tanıyalım" ekranında girilir;
  - kullanıcının notları, fotoğrafları, PDF'leri ve Office dosyaları (yapay zekâya gönderilir);
  - çalışma istatistikleri ve başarımlar;
  - uygulama içi geri bildirim ve "Cevabı bildir" (cihaz modeli ve Android sürümü dahil, `feedback.device`);
  - **Cloudflare Turnstile'ın topladığı cihaz bilgisi**: bot doğrulaması için tarayıcı ve cihaz sinyalleri ile IP. Amacı güvenlik ve dolandırıcılığı önlemek; veriyi Cloudflare hizmet sağlayıcı olarak işler.
  - Aktarım şifreli mi: evet (HTTPS). Hesap ve veri silinebilir mi: evet. Gizlilik politikasında yapay zekâ işleyicisi (Google Gemini, Vercel üzerinden) ve Cloudflare yazmalı.
- **Üretken yapay zekâ kuralı** (Google Play "AI-Generated Content" politikası): yapay zekâyla içerik üreten uygulamada kullanıcı rahatsız edici ya da zararlı bir cevabı **uygulamadan çıkmadan, içeriden** bildirebilmeli. Karşılığı adım 12b ("Cevabı bildir" → `feedback`). Bildirimler düzenli okunmalı; bu kullanıcının işi: Supabase'de `feedback` tablosunda `message`'ı "[YZ cevabı]" ile başlayan satırlar. *(Politikanın güncel metnini **Play Console'da kontrol et**.)*
- **Hedef kitle ve yaş (karar bekliyor):** LGS öğrencileri 13-14 yaşında. Play Console → **App content → Target audience and content** formunda 13 yaş altı bir grup seçilirse **Aileler (Families) politikası** devreye girer: reklam ve SDK kısıtları, ek inceleme, girişte ek şartlar gibi. **Öneri: "13 yaş ve üstü"** (13-15, 16-17, 18+) seçmek; uygulama ve mağaza metni 13 yaş altını hedeflememeli. Karar kullanıcıda (bölüm 11, soru 6).
- **Hesap silme:** Uygulamada hesap açılabildiği için iki yol şart: (1) uygulama içinden silme (adım 12), (2) Data safety formunda **web'den silme isteği bağlantısı**. Bağlantı **`https://studymode.fun/hesap-sil`**: giriş istemeden açılan, nasıl silineceğini anlatan sayfa (bu turda site rolü ekliyor). Uygulamada Ayarlar → Hakkında'da da bu adres gösterilir (`?app=android` ile, bölüm 8). *(Bağlantının giriş istemeden açılması gerektiğini **Play Console'da kontrol et**.)*
- **Gizlilik politikası:** `https://studymode.fun` üzerindeki gizlilik sayfası; Android uygulaması ve Google ile giriş anılmalı (site işi).
- **Hedef API seviyesi:** Yeni uygulamalar ve güncellemeler, en son Android sürümünden en fazla bir yıl geride bir API seviyesini hedeflemeli (her yıl ağustos sonunda yükselir). Proje Android Studio'nun önerdiği en yeni `targetSdk` ile açılır. *(Bugünkü zorunlu sayıyı **Play Console'da kontrol et**.)*
- Uygulama paketi biçimi AAB; **Play App Signing** açık (Google imza anahtarını tutar, kullanıcı yalnızca "upload key"i saklar; bu dosya ve şifresi **repoya ve sohbete girmez**).
- Sitenin `/paylas/*` bağlantılarının uygulamayı açması için ileride `https://studymode.fun/.well-known/assetlinks.json` gerekir (Play imza anahtarının SHA-256'sıyla) — site işi, mağazadan sonra.

## 10. Android Studio kurulumu (macOS, Apple Silicon)

1. **İndir:** Safari'de https://developer.android.com/studio → **Download Android Studio** → koşulları kabul et → **Mac with Apple chip** seç → `.dmg` iner.
2. **Kur:** `.dmg`'yi aç → Android Studio simgesini **Applications** klasörüne sürükle → Launchpad'den aç. "İnternetten indirildi, açılsın mı?" → **Open**.
3. **İlk açılış sihirbazı:** "Import settings" sorusunda **Do not import** → kullanım verisi sorusu (istediğin gibi) → **Next** → kurulum türü **Standard** → tema seç → **Next** → lisanslar ekranında soldaki her lisansı seçip **Accept** (hepsi kabul edilmeden "Finish" açılmaz) → **Finish**. SDK, emülatör ve araçlar iner (birkaç GB, 10-20 dk).
4. **SDK kontrolü:** Karşılama ekranı → **More Actions → SDK Manager** → "SDK Platforms" sekmesinde en yeni Android sürümü işaretli olmalı; "SDK Tools"ta **Android SDK Build-Tools**, **Android Emulator**, **Android SDK Platform-Tools** işaretli olmalı. Eksik varsa işaretle → **Apply**.
5. **JDK:** Ayrıca Java kurma. Android Studio'nun kendi içindeki JDK kullanılır: proje açıkken **Android Studio → Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JDK** = "jbr-…" (JetBrains Runtime, Studio'nun içindeki). Genelde zaten budur.
6. **Emülatör (sanal telefon):** **More Actions → Virtual Device Manager** (proje açıkken sağdaki **Device Manager**) → **+ / Create Virtual Device** → **Phone → Pixel** (ör. en yeni Pixel) → **Next** → sistem görüntüsü olarak en yeni Android sürümünün **"Google Play"** yazan, **arm64** olanını seç (Google ile giriş ve belge tarayıcı için Google Play'li olan şart) → indir → **Next → Finish** → listede ▶ ile başlat. İlk açılışta emülatörde bir Google hesabıyla oturum aç.
7. **Projeyi aç:** (Adım 0 kodlanıp `android-taslak` dalı çekildikten sonra) **File → Open** → `Documents/GitHub/studymode/android` klasörünü seç (reponun kökü değil, `android` klasörü) → **Trust Project** → Studio "Gradle sync" yapar (ilk sefer birkaç dakika). Üstteki cihaz menüsünde emülatörü seç → yeşil ▶ **Run**.
8. **Kendi Android telefonun varsa (USB hata ayıklama):**
   - Telefonda **Ayarlar → Telefon hakkında → Yazılım bilgileri** → **Yapım numarası**'na 7 kez dokun ("Geliştirici oldunuz").
   - **Ayarlar → Sistem (ya da doğrudan) → Geliştirici seçenekleri → USB hata ayıklama**'yı aç.
   - Telefonu USB kablosuyla Mac'e tak → telefonda "USB hata ayıklamaya izin verilsin mi?" → **Bu bilgisayara her zaman izin ver** → **İzin ver**.
   - Android Studio'da cihaz menüsünde telefon görünür → ▶ **Run**. (Kablosuz istersen: Geliştirici seçenekleri → **Kablosuz hata ayıklama** → Studio'da Device Manager → **Pair devices using Wi-Fi**.)
   - Telefonda Google Play servisleri olmalı (Türkiye'de satılan telefonların hemen hepsinde var; bazı Huawei modellerinde yok).
9. `local.properties` (bilgisayara özel SDK yolu) ve imza dosyaları **commit'lenmez**; `.gitignore`'a adım 0'da eklenir.

## 11. Riskler ve açık sorular

**Riskler**
- **PDF metni:** Android'in kendi PDF aracı metin vermiyor; PdfBox-Android'in çıkardığı metin PDFKit'ten (iOS) farklı olabilir. `mathPages` kuralları metnin satırlarına bakıyor; aynı PDF'te iOS ve Android farklı sayfaları "formüllü" sayabilir. Sitenin test örnekleri + aynı gerçek PDF'le karşılaştırma yapılacak.
- **Turnstile + WebView:** Cloudflare'in Android WebView'ı ne sıklıkla kutuya soktuğu bilinmiyor (bölüm 6).
- **Kapalı test şartı:** 12 kişi × 14 gün bulunamazsa yayın gecikir. Bu, kodlamadan bağımsız en uzun yol.
- **Formül gösterimi:** iOS gibi LaTeX → Unicode; büyük matris/tabloda zayıf. Gerekirse yalnızca formül olan yerlerde KaTeX (web görünümü).
- **İki cihaz aynı anda:** kart ve not satırlarında "son yazan kazanır" (site için de geçerli, Aşama 70). Yalnızca değişen sütunları yazmak riski küçültür.
- **Google Play services olmayan cihazlar:** Google ile giriş ve belge tarayıcı çalışmaz; e-posta girişi ve galeri yolu çalışır.
- **Uzun not hazırlığı:** kullanıcı uygulamadan çıkarsa Android işlemi durdurabilir. İlk sürümde "hazırlanırken uygulamayı kapatma" uyarısı (iOS gibi); gerekirse WorkManager.

**Kullanıcıya sorular**
1. Android telefonun var mı (marka/model)? Yoksa ilk denemeler yalnızca emülatörde olur; kapalı test öncesi gerçek cihaz şart değil ama iyi olur.
2. Play Console hesabı kişisel mi açılacak (önerilen), yoksa ileride şirket kurmayı düşünüyor musun? (Kuruluş hesabında 12 kişi/14 gün şartı yok ama D-U-N-S numarası gerekiyor.)
3. Kapalı test için 12+ kişilik bir liste (Gmail adresleri) toplayabilir misin?
4. ~~İlk sürüme Mola ve Çalışma fişi girsin mi?~~ **Cevaplandı:** girmeyecek, sonraki sürüm (adım 13).
5. Uygulamada Premium durumu ("Premium açık") hiç gösterilmesin mi, yalnızca gösterilsin mi? (Satış yok, bu kesin.)
6. **Hedef kitle:** Play Console'daki hedef kitle formunda "13 yaş ve üstü" seçilsin mi (öneri)? 13 yaş altı seçilirse Aileler politikası devreye girer (bölüm 9).
7. "Cevabı bildir" için `feedback.kind`'a ayrı bir değer (ör. `'yz'`) eklensin mi (şema değişikliği, site işi), yoksa `'hata'` + `[YZ cevabı]` öneki yeterli mi (bölüm 5.1)?

**Yöneticiye / site tarafına (docs/ANDROID_SYNC.md'ye yazılması için)**
- `docs/ANDROID_SYNC.md` dosyası henüz yok; site tarafında açılması gerekiyor (rol tarifi böyle diyor).
- Google Play için **giriş istemeyen hesap silme sayfası** `https://studymode.fun/hesap-sil`: bu turda site rolü yapıyor.
- Sitenin `?app=android` modu (satış bağlantılarını gizler): bu turda site rolü yapıyor.
- Gizlilik sayfasına Android uygulaması ve Google Play'in eklenmesi.
- İleride: `/.well-known/assetlinks.json` (`/paylas/*` bağlantıları için, Play imza SHA-256'sı gelince).

**Emin olunmayan kurallar (başlamadan kontrol)**
- Kapalı test şartının güncel sayıları (12 test kullanıcısı, 14 gün) → Play Console'da kontrol et.
- Hedef API seviyesinin güncel alt sınırı → Play Console'da kontrol et.
- Web'den hesap silme bağlantısının giriş istemeden açılması şartı → Play Console'da kontrol et.
- Sitede alınmış Premium'un uygulamada tanınmasının Payments politikasına uygunluğu → Play Console'da kontrol et.
- supabase-kt'de `captchaToken` alanının tam yeri ve `IDToken` girişinde desteklenmesi → kodlarken kütüphane belgesinde kontrol.
- Android Client ID'nin Supabase "Client IDs" listesine eklenmesinin gerekmediği → ilk Google girişinde doğrulanacak.

---

## Defter

### Yapılan
- 28 Kasım 2026: Bu plan yazıldı (`android/PLAN.md`). Kaynaklar okundu: `docs/ROLES.md`, `ios/PLAN.md` ve `docs/IOS_SYNC.md` (ios-taslak), `docs/HANDOFF.md` 0. bölüm + Aşama 67-72, `src/lib/types.ts`, `srs.ts`, `dailyReview.ts`, `mathPages.ts`, `ai/tasks.ts` (`repairLatexEscapes`), `config.ts`, `googleSignIn.ts`, `supabase/schema.sql` (`bump_study_day`, `ai_quota`), iOS'un `Auth/Turnstile.swift`, `Config.swift`, `AI/AIClient.swift`. Kod yok.

### Kararlar
- Kotlin + Compose, MVVM, `data / domain / ui`; bağımlılıklar elle (`AppContainer`), Hilt yok.
- Kapsam ve adım sırası iOS ile aynı; satış yok, Premium koduna/Shopier'e yönlendirme yok.
- Google girişi Credential Manager + sitenin web client ID'si; gizli anahtar yok.
- Turnstile: iOS'taki gibi tek, arka planda başlayan, `interaction-only` WebView; adres studymode.fun.
- PDF metni için PdfBox-Android, sayfa resmi için PdfRenderer; Office dosyaları ek kütüphanesiz.
- `summary`/`practice` ham JSON; `study_days` yalnızca RPC; SRS'te Java `Math.round`.

### İşe yaramayan
- Henüz denenmiş bir şey yok.

### Sıradaki
- Kullanıcı: Android Studio'yu kur (bölüm 10), Play Console hesabını aç ve kimlik doğrulamasını başlat (bölüm 9), Google Cloud'da debug Android istemcisini oluştur (bölüm 7; SHA-1 için önce Studio kurulmalı), kapalı test listesini toplamaya başla.
- Android Claude'u: adım 0 (proje iskeleti) → adım 1 (giriş + Turnstile).

---

### Tur 2 (28 Kasım 2026)

#### Yapılan
- Plan, kalite kontrolün ve kullanıcının notlarıyla düzeltildi (kod yok):
  - `notes.practice` ve `notes.questions` dizi (`JsonArray`) olarak düzeltildi (bölüm 4, 5.1, 5.3, 5.8). `practice`'te yalnızca değişen öğenin `draft`/`evaluation`'ı değişir, gerisi ham yazılır. `questions` yalnızca not hazırlanırken yazılır.
  - SRS "Bilemedim" dalında `ease` yuvarlanmıyor, sınav sınırı da yok (bölüm 5.2, `srs.ts` 35-43).
  - "Tablolarda varsayılan id yok" düzeltildi: `course_shares` ve `feedback`'te `default gen_random_uuid()` var. İki tablonun sütunları `schema.sql`'den yazıldı (5.1).
  - Günlük kuyruğa yalnızca `isDue` kartların aday olduğu yazıldı (5.5, `dailyReview.ts` 68).
  - Google Play üretken yapay zekâ kuralı eklendi: adım 12b "Cevabı bildir" → `feedback` (`kind 'hata'` + `[YZ cevabı]` öneki), satır biçimi 5.1'de, kural bölüm 9'da.
  - Hedef kitle ve yaş bölümü eklendi (öneri "13 yaş ve üstü", soru 6).
  - Data safety'ye `user_metadata.education` (okul, bölüm) ve Turnstile'ın cihaz bilgisi eklendi.
  - Mola + Çalışma fişi "sonraki sürüm" oldu (adım 13, soru 4 cevaplandı).
  - Planın başına "site ile uygulama eşit, hiçbir şey silinerek çözülmez" kuralı, bölüm 3'ün sonuna "ilk sürümden sonra eşitlik sırası" eklendi. Eski "bilerek yok" listesinden VIP mini oyunları ve kendi yapay zekâ anahtarı çıkarılıp sıraya alındı.
  - `?app=android` kuralı (bölüm 8, `Config.siteUrl`) ve hesap silme adresi `https://studymode.fun/hesap-sil` (bölüm 9, 11).
- Adım 0 **yapılmadı**: bu makinede JDK yok (`java -version` → "Unable to locate a Java Runtime"), `~/Library/Android/sdk` yok, `/Applications/Android Studio.app` yok. **Android Studio kurulmadan Adım 0 doğrulanamaz**; derlenemeyen iskelet commit'lenmedi.

#### Kararlar
- "Cevabı bildir" mevcut `feedback` tablosuna şema değişikliği olmadan yazılır (`kind = 'hata'`); ayrı bir `kind` istenirse site işi.
- "Cevabı bildir" ilk sürüme girer (mağaza şartı); Mola ve fiş girmez.
- Site sayfaları yalnızca `Config.siteUrl()` ile, `?app=android` ekli açılır.

#### İşe yaramayan
- Adım 0 için derleme ortamı yok (JDK, Android SDK ve Android Studio eksik). Kod yazılmadı.

#### Sıradaki
- Kullanıcı: Android Studio'yu kur (bölüm 10). Kurulunca `java` için Studio'nun JDK'sı (`/Applications/Android Studio.app/Contents/jbr`) ve `~/Library/Android/sdk` hazır olur; Android Claude'u Adım 0'ı o zaman yapar ve `./gradlew assembleDebug` ile doğrular.
- Kullanıcı: soru 6 (hedef kitle) ve soru 7 (`feedback.kind`) cevapları.
- Android Claude'u: Adım 0 → Adım 1.
