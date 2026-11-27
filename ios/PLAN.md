# StudyMode iOS — plan ve notlar

Uygulama Claude'unun çalışma planı. Site ile ortak işler `docs/IOS_SYNC.md`'de, ekip düzeni `docs/HANDOFF.md` → "0. Ekip düzeni"nde.

## Adımlar (ilk sürüm)

| | Adım | Durum |
|---|---|---|
| 1 | Giriş / kayıt / şifre sıfırlama (Turnstile web görünümünden) | ✅ |
| 2 | Dersler ve not listesi (salt okuma) | ✅ |
| 3 | Not: özet (kavramlar, ana noktalar, tam özet), LaTeX → Unicode | ✅ |
| 4 | Kartlar ve Tekrar (srs.ts birebir; `cards`, `study_days`, `completedSteps` yazımı) | ✅ |
| — | Hesap silme, Apple ile giriş, Google ile giriş, şifre otomatik doldurma, uygulama simgesi | ✅ (Apple ve otomatik doldurma ücretli ekibi bekliyor) |
| — | Açılış akışı: 3 interaktif/animasyonlu tanıtım sahnesi (canlı not tarama + fosforlu kalem boyama, 3B çevrilebilir kart/özet/test destesi, unutma eğrisi + sınav hazırlık sayacı, Fosfor maskotu), ardından "Seni tanıyalım" (`user_metadata.education`, site gibi v2) ve kayıt; bot doğrulaması arka planda ve görünmez (`Onboarding.swift`, `OnboardingScenes.swift`, `FosforMascotView.swift`; anahtar `studymode.onboarding.v2`) | ✅ yenilendi 26 Kasım |
| — | Yeni Tekrar (kalite kontrol önerisi): günlük hedef 15, günde en fazla 5 yeni, sıra (sınav → bilinemeyen → gecikmiş → yeni), "Bugün tamam" + "Biraz daha", ders bazında hazırlık (sitenin `examReadiness`'i birebir) | ✅ kodlandı 26 Kasım; giriş yapılmış ekranda henüz görülmedi |
| 5 | Test (sorular, "Kontrol et" + açıklama, sonuç, yanlışlar, tekrar çöz, yanlışları karta çevir; `quiz_attempts`, `study_days.quizzes`, `sina` adımı) | ✅ kodlandı 26 Kasım; giriş yapılmış ekranda henüz görülmedi |
| 6 | Not ekleme: metin, fotoğraf (kamera/galeri → `transcribe`), PDF (PDFKit metni, taranmış sayfa → `transcribe`); not önce kaydedilir, sonra `study` ile 12.000 karakterlik parçalar, 3 aynı anda, zaman aşımında yarıya bölme (bölme sitenin koduyla karşılaştırıldı, aynı); yeni ders ekleme; hazırlanmamış notta "Şimdi hazırla" | ✅ kodlandı 26 Kasım; gerçek notla henüz denenmedi |
| — | Formüllü PDF sayfalarını resim olarak okutma (sitenin `mathPages.ts`'i → `AI/MathPages.swift`, eski "Bilinen eksik (6)"): bozuk formüllü, taranmış ve formül ağırlıklı belgede şekilli sayfalar resim olarak `transcribe` ile okunur; sıra korunur, okunamayan sayfa kendi metnini tutar. Siteyle yeniden karşılaştırıldı ve eşitlendi: ölçek en fazla 2 kat (uzun kenar 1600 px), JPEG 0.8, 4 sayfaya kadar her sayfa ayrı istekte | ✅ 27 Kasım; gerçek formüllü PDF ile canlıda denenmedi |
| — | Kart turu "karıştır" (`ReviewSession` sağ üst araç çubuğu), 3B kart çevirme + sağa/sola kaydırma damgaları (`BİLDİM` / `TEKRAR`), tüm iç ekranlarda (`CoursesView`, `CourseDetailView`, `NoteDetailView`, `QuizSection`, `NoteCardsSection`, `AddNoteView`, `ReviewTab`, `MainTabs`) "Fosforlu" animasyon kiti (`MotionKit.swift`: kayan fosforlu sekme çubuğu, iskelet yükleme, doğru/yanlış fiziksel tepkiler, Fosfor kutlama rozetleri, Hesap → "Açılış tanıtımını gör") | ✅ 26 Kasım (`son tekrarı geri al` hâlâ yapılacaklar listesinde) |
| — | Bugün (sitenin Today.tsx'i, "Çalışma masam" sekmesinde): selam + tarih, YKS/LGS geri sayımı (gizlenebilir), "Şimdi bununla başla" (`pickExamFocus` birebir), son 7 gün şeridi ve seri, akıllı plan (`buildSmartStudyPlan` birebir), adım adım devam, diğer sınavlar, zayıf konular, son notlar; her not bir kez görünür. Bağlantılar notu doğru adımda açar (`NoteRoute`). Adım 5 "Anlat" (PracticeTab): açık uçlu sorular, otomatik kaydedilen cevap (`notes.practice` ham JSON, yalnızca `draft`/`evaluation`), yapay zekâ puanlama (`grade`), örnek cevap, "Bitir: Konuyu öğrendim". `study_days` yazımları artık `bump_study_day` RPC ile | ✅ kodlandı 26 Kasım; giriş yapılmış ekranda henüz görülmedi |
| — | Not menüsü (sağ üst): Kaynak metin, Notu düzenle (başlık, ders, metin; metin değişince `summary.sourceChanged` ve uyarı), Yeniden hazırla, Özeti paylaş (Markdown), Notu sil (sınavların `note_ids`'inden çıkarılır, kartlar ve test sonuçları cascade ile gider). "Bu konuyu anlamadım" her kavramın ve ana noktanın altında (`explain`: daha basit, örnek, adım adım; notun ilgili bölümü `contextAround` ile). Tam özet sekmesi her zaman var: yoksa "Ayrıntılı özet hazırla" (`detail`, 12.000'lik parçalar sırayla, `summary.detailed`'e ham JSON ile), varsa yeniden yazma | ✅ kodlandı 27 Kasım; giriş yapılmış ekranda henüz görülmedi |
| — | Ders menüsü (sağ üst ⋯): Dersi düzenle (ad + sitenin 8 rengi), Dersi paylaş (sitenin `share.ts` birebir: yalnızca içerik, ilerleme yok; `course_shares` tablosu, 22 karakterlik bağlantı, QR kod, WhatsApp vb. paylaşım, kopyala, "şimdiki hâliyle güncelle", "paylaşımı kapat"), Dersi sil (cascade). Paylaşılan dersi uygulamadan **ekleme** henüz yok (bağlantı sitede açılıyor) | ✅ kodlandı 27 Kasım; giriş yapılmış ekranda henüz görülmedi |
| — | Fosfor asistanı (sitenin Assistant.tsx + assistant.ts birebir): sağ altta yüzen Fosfor düğmesi ve notun ⋯ menüsünde "Fosfor'a sor"; açık not/ders otomatik seçilir, ders değiştirilebilir; dersin notlarından bağlam (`buildAssistantContext`: açık not 9.000, diğerleri 2.500, toplam 16.000), `chat` görevi, öneri soruları, **kalın** yazı, "Karta çevir" (kaynak "Fosfor"), sohbet ders başına cihazda 7 gün (çıkışta silinir). Fosfor maskotu artık açık renkli, çerçeveli bir karonun üstünde (koyu kartlarda da görünsün diye; açılış sahnelerinde çerçevesiz) | ✅ 27 Kasım; genel soru simülatörde denendi |
| — | Ayarlar (Hesap → Ayarlar; sitenin Settings sayfasından uygulamaya uyanlar): günlük kart hedefi (1-500, varsayılan 15, cihazda tutulur, Bugün ve Tekrar bunu kullanır), okul seviyesi (`user_metadata.education.level`, diğer cevaplar korunur; sınav dili ve LGS/YKS sayacı buna göre), tema (Sistem/Açık/Koyu), geri bildirim (`public.feedback`, 20 sn bekleme), Hakkında (sürüm, gizlilik, kullanım koşulları). Kendi yapay zekâ anahtarı ve Premium kodu bilerek yok | ✅ kodlandı 27 Kasım; giriş yapılmış ekranda henüz görülmedi |
| — | Başarımlar ve seviye (Hesap → Başarımlar ve seviye; sitenin achievements.ts + xp.ts birebir): 20 başarım (gizliler ipucuyla), seviye halkası ve unvan, "XP nereden geldi?" (tüm `study_days` + testler + provalar + hazırlanan notlar + başarımlar), hedef ilerleme çubukları. Başarımlar hesapta (`user_metadata.achievements`, site ile ortak; `achievements_held` geri alınanlar geri gelmez). Uygulama yüklenince, tekrar/test sonrası ve uygulamaya dönünce hedefleri ve saat başarımlarını (03.00, 04-06, 00.00) kontrol eder, yenisini kaydeder ve üstte kısa bir bildirim gösterir; koleksiyon boşken eskiden kazanılanlar sessizce eklenir | ✅ 27 Kasım; simülatörde görüldü |
| — | Mola (Tekrar → Kısa bir mola; sitenin mola.ts + MatchGame + QuickGame birebir): ders seçimi, **Eşleştir** (6 çift, solda kavram sağda cevap, yanlış +2 sn, rekor), **Hızlı tur** (60 sn, 3 hak, 3 doğrudan sonra 2 puan, kaydırma ya da düğme, rekor), **Odak sayacı** (saat uygulamasının FocusClock modeli: 25+5 / 50+10, 4. turda uzun mola, bildirimler, günlük dakika ve tur; "Odak Ustası" başarımı buna bağlı), öğrenci tipi testi sitede açılır. Rekorlar ve odak dakikaları cihazda (`studymode.mola.v1`, sitedekiyle aynı şekil). Oyunlar serini korur (`actions`), tekrar planına dokunmaz. VIP mini oyunları yok | ✅ 27 Kasım; Eşleştir ve Hızlı tur simülatörde denendi |
| — | Çalışma fişi (`Receipt/ReceiptModel.swift`, `ReceiptPaperView.swift`, `ReceiptStudioSheet.swift`; sitenin `receipt.ts` + `ReceiptCard.tsx` veri/gizlilik kurallarıyla uyumlu + iOS'a özel interaktif stüdyo): Bugün selamlama çubuğu ("Çalışma fişi"), günlük tekrar sonu ("Çalışma fişini kes") ve Hesap sekmesinden açılır; termal kasa ağzından haptik adımlarla çıkan fiş ve kauçuk mürekkep damga animasyonu (`S+ / A+ / B+ / C+`), parmakla 3B eğme + diyagonal parlama ve aşağı çekip kopararak paylaşma ("Koparıp paylaş"), 5 kağıt/mürekkep teması (`Fosforlu`, `Gece`, `Espresso`, `Pembe`, `Kobalt`), `studymode.receiptPrefs.v1` ile isim/bölüm/alt not özelleştirme, ilk açılışta `"fis"` ("Kasadan Geçti") başarımını açma ve `ImageRenderer` ile `1080×1920` Story PNG paylaşma / Fotoğraflar'a kaydetme | ✅ 27 Kasım |
| — | Premium (Apple ile satın alma, StoreKit 2; Hesap → Premium): 3 ürün (`premium.twoweeks` yenilenmeyen 14 gün, `premium.monthly`, `premium.sixmonths` otomatik yenilenen; grup 22628551). Satın almada `appAccountToken` = kullanıcı kimliği; imzalı işlem `POST /api/apple-purchase`'e gider, sunucu kabul edene kadar `finish()` yok (açılışta yeniden denenir). Premium durumu = max(StoreKit kaydı, `ai_quota().premium_until`); 2 haftalıklar üst üste eklenir; iade edilen sayılmaz. Satın alımları geri yükle, Aboneliği yönet, Apple'ın istediği yenileme metni + EULA/gizlilik bağlantıları. Ekran yalnızca uygulamada gerçekten çalışan ve Premium'la değişen şeyleri satar: **Free+** (günde 30 cevaba kadar daha güçlü model) ve **günde 150 hak** (ücretsiz hesapta 40); site araçları tek küçük "Sitede ayrıca" satırında. Premium zaten açıksa satın alma düğmesi yok (`PremiumStore.source`): VIP/yönetici ve site kodu → yalnızca durum + Geri yükle; App Store aboneliği → durum + Aboneliği yönet; 2 haftalık paket → durum + "14 gün ekle" (üst üste eklenir). Uygulamada siteye satın alma ya da Premium kodu bağlantısı yok (Ayarlar'daki "Diğer ayarlar sitede" ve Hesap'taki "studymode.fun'u aç" kaldırıldı; gizlilik, koşullar ve öğrenci tipi `?app=ios` ile açılır). StoreKit kaydı yalnızca `appAccountToken` = oturumdaki kullanıcı ise sayılır (28 Kasım). PR #134 birleşti (28 Kasım): `api/apple-purchase.ts`, `api/apple-status.ts`, `api/apple-notifications.ts` main'de. **Bekleyen:** App Store Connect'te Server Notifications URL'si (V2) ve `APPLE_APP_APPLE_ID` (kullanıcının panel işi, IOS_SYNC madde 8); satın alma inceleme görüntüsü ve ürün açıklamaları | ✅ kodlandı ve metni düzeltildi 27 Kasım; gerçek satın alma TestFlight sandbox'ta denenecek |
| 7 | Toparlama: hata mesajları, boş ekranlar, erişilebilirlik, birim testleri | boş ekranlar ve yükleme durumları yenilendi; birim testleri sırada |

## Bekleyenler (dış engel)

- **Ücretli Apple ekibi** ✅ **Açıldı (26 Kasım):** Team ID değişmedi (`Q2VWX7322K` ücretli bireysel ekip olarak devam ediyor; sitedeki `apple-app-site-association` dosyası zaten doğru). `StudyMode-Info.plist` ve `StudyModeWatch` hedefine `ITSAppUsesNonExemptEncryption = false` eklendi; `0.1 (2)` sürümü `testFlightInternalTestingOnly = false` (TestFlight & App Store) ile App Store Connect'e yüklendi (`adamId: 6839693003`).
- **Google marka doğrulaması:** Google Auth Platform'da logo yüklü olduğu için marka doğrulaması istiyor; `studymode.fun` Search Console'da doğrulanmalı (Hostinger DNS TXT kaydı, 24 saat bekleme). Girişi engellemiyor (uygulama "In production"). Site/alan adı işi.

## Fikirler (kullanıcıyla konuşuldu, 26 Kasım)

> Açılış akışı ve bot doğrulaması aşağıdaki gibi yapıldı (✅). Gerçek cihazda Cloudflare'in kutuyu ne sıklıkla istediği henüz gözlenmedi.

**Açılış akışı: önce tanıtım ve "seni tanıyalım", giriş en sonda.** Kullanıcı: "Direkt login'e atması mantıksız, bot doğrulaması deli ediyor."
- 2-3 sayfa tanıtım (notunu yükle → özet, kart, test → sınava hazır mısın), sonra "Seni tanıyalım" (seviye: ortaokul / lise / üniversite / mezun; okul öğrencisine YKS/LGS), sonra "Hadi başla" → giriş/kayıt (Apple ve Google önde, e-posta ikinci).
- Cevaplar cihazda tutulur, girişten sonra sitenin kullandığı `user_metadata.education` alanına yazılır (`{ level, school, department, classYear, …, v: 2, at }`, HANDOFF Aşama 27-28 ve 65). Böylece sınav dili (vize/final ↔ yazılı) doğru gelir, sitedeki "Seni biraz tanıyalım" tekrar sormaz. Yazmadan önce alanın tam şekli site Claude'una sorulmalı.
- **Girişsiz kullanım yok:** yapay zekâ sunucuda girişi zorunlu tutuyor; HANDOFF kararı "basit mod yok, hesap açmaya yönlendir". Giriş kalıyor, sadece sona taşınıyor.

**Bot doğrulaması daha az görünsün:**
- Turnstile'ı `appearance: 'interaction-only'` ile çizmek: kutu yalnızca Cloudflare etkileşim isterse görünür.
- Doğrulamayı uygulama açılınca arka planda başlatmak; kullanıcı tanıtımı geçerken jeton hazır olur. Jeton tek kullanımlık ve ~5 dk geçerli; süresi dolarsa sessizce yenilenir.
- Tamamen kaldırmak (Apple App Attest) sunucu değişikliği ister; şimdilik değil.

**Sonra bakılacak (kullanıcı, 26 Kasım)**
- **Cloudflare kutusu:** gerçek iPhone'da hâlâ çıkıyor, tıklayınca geçiyor. Kullanıcı: "Okey gibi, sonra bakarız." Turnstile Managed kalıyor (IOS_SYNC madde 7).
- **Sınav notu girilince (taşıma bitince bakılacak):** not girilince kısa bir kutlama/tepki animasyonu, notun yorumu (ör. ağırlıklara göre "finalden şu kadar alman yeterli") ve ona göre bir çalışma yolu önerisi. Kullanıcı emin değil ("belki"), fikir olarak duruyor. Sitede de olacaksa IOS_SYNC'e taşınır. Not: HANDOFF Aşama 60'ta "ağırlıklı ortalama / finalden kaç almam lazım" bilinçli olarak yapılmamıştı (geçme kuralları okula göre değişiyor); yapılırsa bu dikkate alınmalı.

- **Google ile girişte her seferinde e-posta (kullanıcı, 26 Kasım; Gmail'de doğrulandı):** her uygulama girişinde Google "Bazı Google Hesabı verilerinizi StudyMode ile paylaştınız" gönderiyor (26 Kasım 17:07, 17:33, 17:42: üç giriş, üç e-posta). E-posta sebebi kendisi yazıyor: "Google ile oturum açma özelliğini kullanarak StudyMode uygulamasında oturum açtığınız için". Site yalnızca ilk girişte alıyor: site Google'ın kimlik düğmesini (GIS, kimlik belirteci) kullanıyor, uygulama ise iOS istemcisiyle tam OAuth akışı (yetki kodu + PKCE, `prompt=select_account`) yapıyor. Normal kullanımda bir cihazda bir kez giriş yapıldığı için e-posta da bir kez gelir; testteki tekrarlar çıkış/yeniden kurulumdan. Denenebilecekler (etkisi doğrulanmadı): `prompt=select_account`'u kaldırmak, ya da Google'ın iOS kütüphanesi (GoogleSignIn) ile tekrar girişte önceki oturumu geri yüklemek.

**Diğer küçük notlar**
- Kart turu "son tekrarı geri al" (sitede var, uygulamada yok; "karıştır" `ReviewSession` sağ üst çubuğuna eklendi).
- ~~Site ve uygulama aynı anda açıkken `study_days` sayacı kaybı~~ → çözüldü: uygulama `bump_study_day` RPC kullanıyor (26 Kasım).
- Formüller Unicode ile çiziliyor; büyük matris/tabloda zayıf. Gerekirse yalnızca formül olan yerlerde KaTeX (web görünümü).

## Devir notu (Google Antigravity oturumu — 26 Kasım)

Kullanıcının isteğiyle yalnızca arayüz, etkileşim ve animasyon katmanı (`ios/StudyMode/`) yenilendi; **veri, Supabase, kimlik doğrulama, SRS, AI istemcisi ve Xcode proje ayarlarına (`Data/`, `Auth/`, `AI/`, `Config.swift`, `project.pbxproj`) hiç dokunulmadı.**

- **Commit `7425556` — Açılış akışı (`ios/StudyMode/Onboarding/`):**
  - `FosforMascotView.swift`: Sitedeki `FosforCharacter` maskotunun native SwiftUI `Canvas` çizimi (göz kırpma, nefes salınımı, sahneye göre ifade, dokununca zıplama + haptik) ve geometrik kıvılcım efekti (`HighlighterSparkBurst`).
  - `OnboardingScenes.swift`: 3 interaktif sahne — (1) tarama çizgisi + harfleri piksel maskeyle boyayan canlı fosforlu kalem (`ScannerHighlightScene`), (2) gerçek 3B dönen ezber kartı, özet ve canlı mini test destesi (`StudyDeckOrchestraScene`), (3) tekrarsız unutma eğrisine karşı StudyMode yakalama grafiği ve sayaçlı hazırlık çubuğu (`ExamReadinessArenaScene`).
  - `Onboarding.swift`: Paralaks spot ışıklı kareli zemin, başlıklarda gecikmeli fosforlu vurgu, seviye seçilince canlı önizleme bandı. `OnboardingStore` tamamlanma anahtarı `studymode.onboarding.v2` yapıldı; `StudentLevel`, `pendingLevel` (`studymode.onboarding.level`), `onFinish` ve arka plan `TurnstileView` sözleşmeleri birebir korundu.
- **Commit `e6bfa0d` — İç ekran animasyon kiti ve 3B kart destesi:**
  - `MotionKit.swift`: Ortak `FosforSegmentedBar` (`matchedGeometryEffect` kayan fosforlu sekme çubuğu), `StudyLoadingStage` (iskelet shimmer + Fosfor), `FosforProgressBar`, `CelebrationBadgeView`, `StaggeredAppearModifier` ve `TactileCardButtonStyle`.
  - `ReviewSession.swift` & `ReviewTab.swift`: Gerçek 3B kart çevirme (`FlippableStudyCard`), alttan yükselen deste derinliği, `.simple` modda sağa/sola sürükleyerek cevaplama (`BİLDİM` / `TEKRAR` damgaları), sağ üst araç çubuğunda kalan kuyruğu karıştıran **Karıştır** düğmesi ve tur sonunda Fosfor'lu kutlama rozeti.
  - `CoursesView.swift`, `CourseDetailView.swift`, `NoteDetailView.swift`, `QuizSection.swift`, `NoteCardsSection.swift`, `AddNoteView.swift`, `MainTabs.swift`: PR #126 ("Çalışma masam") yapısı korunarak kayan sekmeler, testte doğru/yanlış fiziksel tepkiler (kıvılcım / yatay sarsıntı), AI hazırlık aşamalarında çalışan Fosfor göstergesi ve `Hesap` sekmesine çıkış yapmadan tanıtımı açan **"Açılış tanıtımını gör"** düğmesi eklendi.
  - Tüm animasyonlarda `@Environment(\.accessibilityReduceMotion)` kontrolü var; tasarım kurallarına uygun olarak emoji kullanılmadı ve sarı (`Theme.hi`) hiçbir yerde metin rengi yapılmadı.
- **Apple Watch kadran ve animasyon yenilemesi (`ios/StudyModeWatch/`):**
  - `WatchVisuals.swift` & `StudyModeWatchApp.swift`: Altı açık 256° kronograf odak halkası (`ChronographArcView`), nefes alan OLED kareli defter arka planı (`WatchAmbientBackdrop`, Always-On Display `isLuminanceReduced` uyumlu), göz kırpan/ifade değiştiren saat boyu `WatchFosforView` maskotu (Odak'ta sarı, Mola'da nane yeşili), 4 turluk mola döngüsü kapsülleri, tur geçişlerinde kıvılcım patlaması + `WKInterfaceDevice` titreşimleri (`start`/`stop`/`click`/`success`) ve Digital Crown ile inilen 2. sayfada (`TabView(.verticalPage)`) bugünkü odak özeti + dokunsal `25+5` / `50+10` plan kartları eklendi. `FocusClock.swift`, `@AppStorage("watch.focus.v1")` ve yerel bildirim kimlikleri (`mola.focus`, `mola.rest`) birebir korundu.
- **Sınavlar sekmesi, sınav takvimi yönetimi ve Sınav Provası (`ios/StudyMode/Exams/`, `ExamOperations.swift`, `ExamMaker.swift`):**
  - `MainTabs.swift` içine sitedeki `/sinav` karşılığı olan **Sınavlar** sekmesi (`ExamsHubTab.swift`) eklendi: en yakın sınav odak kartı, sınavı bitip notu girilmemiş dersler için "Not gir" uyarısı, sınav takvimi ve ders bazlı "Prova çöz" başlatıcı.
  - `CourseExamEditorSheet.swift` & `ExamOperations.swift`: `course_exams` ekleme / düzenleme / silme, `courses.exam_date` yakın tarih senkronu (`store.tsx` ile birebir), `time`/`grade` sütunları yoksa geriye dönük güvenli yazma ve sınav notu girildiğinde Fosfor kutlama tepkisi.
  - `MockExamView.swift` & `ExamMaker.swift`: Sitedeki `Exam.tsx` + `exam.ts` + `examPlan.ts` ile birebir uyumlu **Sınav Provası** (`/api/generate` `exam` ve `grade` görevleri): Test + Ortak kelime havuzlu Boşluk Doldurma + AI puanlamalı Klasik yazılı soru üretimi, hazır sorulardan çevrimdışı mod, gerçek zamanlı süre sayacı, sonuçların `exam_results` tablosuna ve `study_days.quizzes` serisine yazılması ve eksikleri tek dokunuşla karta çevirme.

## Devir notu (Claude, ana iOS ajanı — 27 Kasım): Fosfor'un yeri
- Fosfor'un artık **kendi sekmesi** var (Dersler · Tekrar · **Fosfor** · Sınavlar · Hesap). `AssistantSheet(inTab: true)`: büyük `FosforHero` (dokununca/ara sıra `FosforScreen` cümlelerini söyler), genel sohbet, ders seçici; kapat düğmesi yok ve nottan gelen soruları (`place.pending`) almaz, onları nottaki yarım sayfa sohbet alır.
- Ana ekranların başlığındaki konuşan Fosfor kaldırıldı: `TalkingFosfor` yerine `HeaderRow` (sadece içerik). Kural: **ekranda tek Fosfor**. Ders/nottaki küçük yüzen düğme, "Fosfor'a sor" uzun basma, boş durum / hazırlanıyor / test sonu tepkileri kalıyor. Yeni ekranlara dekor amaçlı Fosfor eklemeyin.
- Ders/nottaki Fosfor artık **üst çubukta** (⋯ menüsünün yanında, `FosforToolbarButton`); yüzen düğme kalktı, içeriğin üstüne binmiyor.
- **Not ekle → Dosya:** PDF'e ek olarak PowerPoint (.pptx), Word (.docx), Excel (.xlsx), .txt/.md. `Notes/OfficeText.swift` sitenin `officeText.ts` kurallarıyla aynı (Slayt N + konuşmacı notları); Excel uygulamaya özel (sayfa adı + satırlar). Paylaş menüsü de aynı dosyaları alır (`PDFInbox.accepted`, `Item.ext`; eski kayıtlar PDF sayılır).
- **Formüllü PDF sayfaları resim olarak okunuyor** (`AI/MathPages.swift`, sitenin `mathPages.ts` kuralları birebir; sitenin test örnekleri Swift'te de geçiyor). Satırlar karakter konumundan bölünüyor (PDFKit bazen sayfayı tek satır veriyor). Okunan sayfalar sırasını koruyor: iki sayfa tek istekte ancak art arda ise gidiyor; okunamayan formül sayfası kendi metnini koruyor.
- **Paylaşılan ders uygulamada** (`Data/SharedCourse.swift`, `Courses/SharedCourseView.swift`): Çalışma masası → "Arkadaşının dersini ekle" → bağlantıyı yapıştır ya da QR tara → sitenin /paylas sayfasının aynısı → "Derslerime ekle" (sitenin `importCourse` kuralları: aynı ad varsa "(paylaşılan)", kartlar sıfırdan, yaklaşan sınavlar; yarıda kalırsa ders geri silinir). Canlıda denendi ve temizlendi. `onOpenURL` + `applinks:studymode.fun` hazır; linkin doğrudan uygulamayı açması için sitenin `apple-app-site-association` dosyasına `applinks` (/paylas/*) eklenmeli — site işi.

## Devir notu (Google Antigravity oturumu — 27 Kasım): Çalışma Fişi
- **`ios/StudyMode/Receipt/` (`ReceiptModel.swift`, `ReceiptPaperView.swift`, `ReceiptStudioSheet.swift`):**
  - Veri ve gizlilik kuralları sitenin `src/lib/receipt.ts` ve `ReceiptCard.tsx` mantığıyla birebir uyumlu: `Bugün` / `Bu hafta` dönemleri, `study_days` + `MolaRecords` (`studymode.mola.v1`) odak dakikası/turları + `cards.updated_at` (`Card.columns`'a salt okunur `updated_at` eklendi) + `quiz_attempts` + `exam_results` verilerinden ders bazlı döküm, 7 günlük termal ritim matrisi, `S+ / A+ / B+ / C+` derece hesabı, FNV-1a deterministik barkod; not başlıkları veya içerikleri asla fişe yazılmaz.
  - **İnteraktif Termal Stüdyo:** Üstteki termal yazıcı ağzından haptik adımlarla çıkan fiş kağıdı, ardından çift halkalı kauçuk mürekkep damga vuruşu (fişe çift dokununca damga yeniden basılır), parmakla sürükleyince gerçek 3B perspektif eğilme + diyagonal parlak yansıma ve fişi aşağı doğru çekip kopararak doğrudan paylaşma ("Koparıp paylaş") hareketi eklendi. Ekranda tek Fosfor kuralına uyularak fiş ekranına dekoratif Fosfor konmadı.
  - **5 Kağıt/Mürekkep Teması & Özelleştirme:** `Fosforlu`, `Gece`, `Espresso`, `Pembe` ve `Kobalt` temaları; `studymode.receiptPrefs.v1` altında isim/bölüm (`AuthModel.educationSubtitle` ile otomatik ön-dolum, tek anahtarla gizlenebilir) ve hazır cümle yongaları (`moodPresets`).
  - **Story Dışa Aktarım & Başarım:** `ImageRenderer` ile tam `1080×1920` çözünürlüklü Story posteri (`ReceiptStoryPosterView` — kareli masa zemini, bant, hafif eğim, gölge ve `studymode.fun` alt rozeti) üretilip sistem paylaşım menüsüne ve doğrudan Fotoğraflar galerisine (`INFOPLIST_KEY_NSPhotoLibraryAddUsageDescription` eklendi) kaydediliyor. İlk açılışta `user_metadata.achievements` içinde `"fis"` ("Kasadan Geçti") başarımını açar.
  - **Giriş Noktaları:** `TodayFeed.swift` selamlama satırı ("Çalışma fişi"), `ReviewSession.swift` günlük hedef bitiş ekranı ("Çalışma fişini kes") ve `MainTabs.swift` → `AccountView` ("Çalışma fişi").

## Devir notu (Claude, iPhone rolü — 27 Kasım): Premium metni
**Yapılan**
- `Premium/PremiumView.swift`: her vaat sunucuyla karşılaştırıldı (`api/generate.ts`; `schema.sql`'de `ai_limit_for`, `plus_limit_for`, `limit_role`). Kalan iki madde: **Free+** (özet, kart, test, Fosfor, puanlama; günde 30 cevaba kadar, sonra normal model) ve **günde 150 hak** (ücretsiz hesapta 40). "Sayfa okuma hakkından düşmez" çıkarıldı: sayfa okuma kimse için sayılmıyor, yani Premium farkı değil. Sesli not, akıllı arama ve görseller artık özellik kartı değil; yalnızca küçük gri "Sitede ayrıca: … (uygulamada yok)" satırı. Tanıtım metni ve Hesap satırı (`MainTabs.swift`) da aynı şekilde.
- `PremiumStore.source` (`role / subscription / pass / account / none`). Satın alma düğmeleri yalnızca `none`'da. `role` ve `account` (VIP, yönetici, site kodu, başka Apple hesabı): durum + Geri yükle. `subscription`: durum + "Aboneliği yönet" (paket değiştirme de orada). `pass`: durum + yalnızca "14 gün ekle" (üst üste ekleme `refresh()`'te aynen duruyor). Durum satırı "… · bitiş <tarih>" ya da "… tarihinde yenilenecek".
- `Settings/SettingsView.swift`: "Diğer ayarlar sitede" (/ayarlar) bağlantısı kaldırıldı, çünkü o sayfada Premium kodu giriliyor (App Review 3.1.1).
- `AI/NoteImport.swift`, `AI/MathPages.swift`: siteyle küçük eşitlemeler (ölçek ≤ 2 kat, JPEG 0.8, 4 sayfaya kadar her sayfa ayrı, satır sonundaki \r kırpılıyor). Algılama kuralları zaten aynıydı.
- `StudyModeApp.swift`: yalnızca DEBUG + simülatörde `-premiumPreview` açılış argümanı Premium ekranını doğrudan açar (inceleme görüntüsü için).

**Kararlar**
- 2 haftalık paketi olan kullanıcı Premium açıkken de 14 gün ekleyebilir (üst üste alma korunuyor). O sırada abonelik önerilmez, çünkü ödenmiş süreyle çakışır.
- Hesap sekmesindeki genel "studymode.fun'u aç" bağlantısı bırakıldı (satın almaya değil ana sayfaya gidiyor); kullanıcıya soruldu.

**İşe yaramayan**
- Simülatörde girişsiz görüntü alınamadı: simülatörde kayıtlı oturum VIP olduğundan `-premiumPreview` VIP durumunu gösterdi (satın alma düğmesi yok, beklendiği gibi). Planların göründüğü yeni inceleme görüntüsü alınamadı; `ios/AppStore/premium-review-screenshot.png` hâlâ eski vaatleri (sesli sohbet, anlamla arama, görseller) gösteriyor.

**Sıradaki**
- Ücretsiz bir test hesabıyla (`-premiumPreview` ya da TestFlight) planların göründüğü yeni inceleme görüntüsü alıp `ios/AppStore/`'daki ve App Store Connect'teki eski görüntünün yerine koymak.
- App Store Connect'teki 3 ürünün ve uygulamanın açıklamaları aynı vaatleri yapıyorsa elle düzeltilmeli (repoda bu metinler yok).

## Premium araçları: site ile eşitlik analizi (28 Kasım)

Kaynak: `origin/main` (c2e04eb), salt okuma. Kural: Premium metni uygulamada çalışmayan bir şeyi vaat etmez; her araç uygulamada çalıştıkça metne (ve "Sitede ayrıca" satırından çıkarak özellik kartına) geri eklenir.

### Üçü için ortak sözleşme (`POST /api/generate`)
- İstek: `{"task": "podcast" | "tts" | "image" | "embed", "input": {...}}`, `Authorization: Bearer <oturum>`. Gövde en fazla 1.500.000 karakter (`api/generate.ts:9`, aşılırsa `413 too_large`). `engine` gerekmez: Premium görevi sunucuda kendiliğinden Free+ yoluna gider (`generate.ts:168`). iOS'un `AIClient.run` katmanı (`ios/StudyMode/AI/AIClient.swift:29`) olduğu gibi kullanılabilir; yalnızca `premium_only` dışında yeni hata kodu yok.
- Premium kapısı: `PREMIUM_TASKS = podcast, tts, image, embed` (`generate.ts:12`); `plus_quota().eligible` değilse `403 premium_only` (`generate.ts:142-146`). `eligible` = `plus_limit_for(limit_role(uid)) > 0` (`schema.sql:477-495`): VIP, yönetici ve `premium_access.until` süren herkes (site kodu ya da Apple satın alması). Sitenin istemci kapısı `usePremium()` (`src/lib/premium.ts`): rol VIP/admin, `premium_until` ya da kendi Gemini anahtarı (iOS'ta kendi anahtar yok).
- Sayım: başarılı podcast / tts / image cevabı `consume_plus` ile Free+ hakkından 1 düşer (günde 30); **embed düşmez** (`generate.ts:210-211`). Free+ hakkı bitmişse (`allowed=false`) ya da Vertex hata verirse istek ücretsiz anahtara düşer ve `consume_ai` ile günlük haktan (150) sayılır; günlük hak da bitmişse `429 daily_limit` (`generate.ts:220-223`).
- Süre: `tts` ve `image` "yavaş" görev: deneme 45 sn, toplam 57 sn (`generate.ts:148-154`); iOS'un 65 sn beklemesi yeterli.
- Cevap: `200 {"result": {...}, "engine": "plus", "model": "...", "plus": {...}}`. Hatalar: `401 unauthorized`, `403 premium_only`, `413 too_large`, `422 blocked`, `429 daily_limit | quota`, `502 bad_output | upstream`, `503 busy | not_configured`, `504 too_slow`, `500 internal` (`generate.ts:117-257`).
- Modeller: `api/vertex.ts:27-31` (tts: `gemini-3.8-flash-tts`, `-lite-tts`; image: `gemini-3.1-flash-lite-image`, `gemini-nano-banana-2.1`; embed: yalnızca `gemini-embedding-001`, çünkü iki modelin vektörü karşılaştırılamaz). Görevin özel çağrısı `src/lib/ai/gemini.ts:68-201`.
- **Saklama:** üçünün de ürettiği hiçbir şey Supabase'e yazılmıyor. Şemada vektör/ses/görsel tablosu, sütunu ya da pgvector yok; Supabase Storage kullanılmıyor. Hepsi tarayıcının `localStorage`'ında. Yani sitede bile cihazlar arası paylaşım yok; iOS'ta cihazda tutmak siteyle **eşit** davranış. Veritabanına giden tek yazma: `store.recordActivity()` (iOS'ta `bump_study_day p_actions`) ve "karta çevir" (`cards` insert). Sitenin verisini bozma riski bu yüzden çok düşük.

### 1. Akıllı arama (embed)
**Sitede nasıl çalışıyor**
- Görev: `input = {texts: string[]}`, sunucu ilk 25 metni ve her metnin ilk 3.500 karakterini alır (`src/lib/ai/tasks.ts:612-614`). Cevap `{embeddings: number[][]}` (`tasks.ts:383-385`). Vertex'te her metin ayrı `:predict` isteği, `task_type: RETRIEVAL_DOCUMENT` (`gemini.ts:68-97`); 3072 sayı döner.
- İstemci: `embedTexts` 25'erli gruplar, her vektörü `compactVector` ile 768 sayıya ve 5 basamağa indirir (`src/lib/ai/index.ts:832-841`, `src/lib/semanticSearch.ts:302-305`). Not metni `buildNoteEmbeddingText` (başlık + genel bakış + kavramlar + ana noktalar + metnin ilk 3.000'i, en fazla 4.000; `semanticSearch.ts:337-346`).
- Saklama: tarayıcıda `localStorage["studymode.embeddings.v1.<courseId>"] = {noteId: [768 sayı]}` (`semanticSearch.ts:296, 317-334`); not başına ~6 KB. Not değişince vektör yenilenmiyor (yalnızca uzunluğu 768 değilse "eksik" sayılır; `src/pages/Premium.tsx:352`).
- Arama: dersin sayfasında "Akıllı aramayı aç" bütün notları gömer (`src/pages/CourseDetail.tsx:89-105`), sorgu en az 3 harfse beklemeli olarak sorgu vektörü alınır (`CourseDetail.tsx:50-65`). Puan = max(yerel kavram kümeleri + Türkçe kök eşleşmesi, vektör puanı); kosinüs 0,74 altı eşleşme değil (`semanticSearch.ts:312-315, 351-419`). Premium sayfasındaki "tüm notlarda" araması `SmartSearch` + `rankNotesByMeaning` (`Premium.tsx:337-400`, `semanticSearch.ts:472`).

**iOS'ta gereken parçalar**
- `AIClient.run("embed", ...)`, 25'erli gruplar; `[Float]` 768, kosinüs (Accelerate `vDSP` ya da düz döngü).
- Hesap ve ders başına cihazda JSON: `Application Support/<userId>/embeddings/<courseId>.json` (çıkışta silinir, Fosfor sohbeti gibi).
- Sitenin `searchNotesSemantic` mantığının Swift'e birebir taşınması (kavram kümeleri, durdurma kelimeleri, kök alma, parça seçimi). Bu aynı zamanda iOS'ta olmayan **sıradan ders içi aramayı** da getirir (Premium dışı açık, aşağıda).
- `CourseDetailView`'da `.searchable`, Premium hesapta "Akıllı aramayı aç" + "x/y not hazır"; Premium sekmesinde tüm notlarda arama.

**Zor noktalar**
- Vektörler sitede yalnızca tarayıcıda: iOS kendi vektörlerini üretip cihazda tutmak zorunda (site ile paylaşılamaz, sunucu tarafı tablo olmadan). Aynı model ve aynı kısaltma kullanıldığı için sonuçlar aynı olur.
- Maliyet: Free+ hakkından düşmez, ama Free+ hakkı bitmişse her sorgu günlük haktan 1 düşer (sunucu davranışı). 25 notluk ders = 1 istek, 25 Vertex çağrısı, ~2-3 sn. Sorgu başına 1 istek: yazarken 600 ms bekleme şart.
- Eski vektör: not düzenlenince site de yenilemiyor; iOS'ta notun `updated_at`'i vektörle birlikte saklanıp değişen not yeniden gömülebilir (siteden iyi, ama farklı olmaz).

**Büyüklük:** Orta (yaklaşık 1-1,5 oturum; sıradan arama dahil).

### 2. Yapay zekâ görselleri (image)
**Sitede nasıl çalışıyor**
- Görev: `input = {title, topic, context, aspectRatio?: "1:1" | "16:9" | "4:3"}` (`tasks.ts:366-379, 595-606`); bağlamdan konu çevresindeki 600 karakter istemde. Cevap `{imageBase64, mimeType: "image/png", caption}` (`gemini.ts:160-201`, `responseModalities: TEXT+IMAGE`).
- İstemci: `generateConceptImage` (`index.ts:819-829`) → `finishAiImage` (`src/lib/imageStore.ts:91`): uzun kenar 1280 px, JPEG 0,86, sağ alta **filigran** (koyu yarı saydam hap, sarı "S" + beyaz "studymode.fun", boyut görsele göre; `imageStore.ts:37-62`).
- İki yer: (a) not → Araçlar → "Görsel & Şema" sekmesi (`src/components/note/VisualAndPodcastTabs.tsx:135-169`), konu + oran seçimi, listede tam ekran, indir, sil, "karta çevir" (`visualToCard`); (b) "Hafıza kodlaması"ndaki akrostişe görsel (`src/components/note/MemoryTabs.tsx:198-225`), Premium değilse ya da hata olursa Fosforlu SVG poster.
- Saklama: `localStorage["studymode.visuals.v1.<noteId>"]` en yeni 8 (`src/lib/visualTools.ts:196-215`), hafıza görselleri `studymode.mnemonicVisuals.v1.<noteId>` (`MemoryTabs.tsx:24`); alan dolarsa eskiler silinir ve söylenir.

**iOS'ta gereken parçalar**
- `AIClient.run("image", ...)`, base64 → `UIImage`, `UIGraphicsImageRenderer` ile 1280 px'e küçültme + filigran (S simgesi asset olarak eklenmeli), JPEG 0,86.
- Not başına cihazda dosya: `Application Support/<userId>/visuals/<noteId>/<id>.jpg` + küçük JSON liste (en yeni 8).
- Notta "Görsel" bölümü: konu alanı, oran, üret, ızgara, tam ekran (yakınlaştırma), Paylaş / Fotoğraflar'a kaydet, sil, karta çevir.

**Zor noktalar**
- Boyut sorun değil: PNG 1-2 MB → base64 ≤ ~2,7 MB, 4,5 MB sınırının altında; canlıda 4,5 sn (HANDOFF Aşama 20).
- İki cihaz arasında görünmez: sitede de yalnızca o tarayıcıda. Paylaşım istenirse Supabase Storage + tablo gerekir (site işi, bugün yok).
- Asıl iş görselin yanındaki **ücretsiz** kısım: sitede aynı sekmede kavram haritası, "kör mod" ve Fosforlu poster var (Premium dışı açık). Eşitlik için o sekme bütün olarak taşınmalı; yalnızca AI görsel taşınırsa sekme yarım kalır.
- Hafıza kodlamasındaki görsel, iOS'ta olmayan "Hafıza kodlaması" sekmesine bağlı.

**Büyüklük:** yalnızca AI görsel Orta (~1 oturum); ücretsiz "Görsel & Şema" sekmesiyle birlikte Büyük (~2 oturum).

### 3. Sesli not (podcast + tts)
**Sitede nasıl çalışıyor**
- Senaryo: `podcast` görevi, `input = {title, text}` (metin 16.000 karaktere kırpılır, `tasks.ts:579`); cevap `{title, summary, lines: [{speaker: Deniz | Mert, role, text, highlight}]}`, 8-12 replik (`tasks.ts:317-349`). İstemci boş replikleri atar, süre tahmini dakikada 135 kelime (`index.ts:758-778`).
- Ses: `tts` görevi, `input = {lines: [{speaker, text}]}`; sunucu en fazla 16 replik ve replik başına 600 karakter alır (`tasks.ts:584-589`). İki konuşmacılı ses (Deniz = Kore, Mert = Puck; lite modelde tek ses; `gemini.ts:99-158`). Cevap `{audioBase64, mimeType: "audio/wav"}`.
- Parçalama: istemci senaryoyu **600 karakterlik parçalara** böler (~40 sn konuşma, ~2 MB WAV; `index.ts:784-816`, `src/lib/podcastTools.ts:147-165`), parçaları sırayla ister; ilk parça gelince çalmaya başlar (`src/lib/partPlayer.ts`, `PartPlayer`), sonunda WAV'ları 44 baytlık başlıkları atıp birleştirir (`podcastTools.ts:194-223`). Canlı ölçüm: 10 replik, 3 parça, toplam ~53 sn; parça başına ~12 sn, 1,5 MB (HANDOFF Aşama 20-22).
- Ekran (`VisualAndPodcastTabs.tsx:440-859`): sohbet gibi balonlar (Deniz solda, Mert sağda), "Stüdyo sesiyle dinle" (senaryo yerel ise önce AI senaryo, sonra ses), hız 1 / 1,25 / 1,5, "Replik 3/17" ilerleme (`lineAtFraction`, `partStartLines`), WAV indir, repliği karta çevir (`podcastLineToCard`). Premium olmayanda (ve "Hızlı önizleme") yerel senaryo (`buildLocalPodcastScript`, ağsız) + tarayıcının konuşma sesi (`speechSynthesis`, tr-TR).
- Saklama: yalnızca senaryo `localStorage["studymode.podcast.v1.<noteId>"]` (`VisualAndPodcastTabs.tsx:50-68`). **Ses hiç saklanmıyor**: `studioAudioUrl` yalnızca bellekte (`:450`); sayfa yenilenince her dinleyişte yeniden üretiliyor (yeniden Free+ harcıyor).

**iOS'ta gereken parçalar**
- `podcast` ve `tts` çağrıları; Swift'te 600 karakter bölme, WAV birleştirme (ya da parçaları `AVQueuePlayer` ile art arda çalma), ilk parçada çalmaya başlama.
- `AVAudioSession(.playback, .spokenAudio)`, `UIBackgroundModes: audio` (Info.plist / proje ayarı), Kilit ekranı: `MPNowPlayingInfoCenter` + `MPRemoteCommandCenter` (oynat/duraklat/15 sn), hız (`AVPlayer.rate`), kesinti (arama) ve kulaklık çıkarma.
- Önbellek: birleşik sesi AAC'ye çevirip (`AVAssetExportSession`, m4a) `Caches/<userId>/podcast/<noteId>.m4a` olarak tutmak: 2,5 dk WAV ~6-7 MB → m4a ~1-1,5 MB. Senaryo değişince ya da not metni değişince silinir. Bu siteden iyi (yeniden üretmez, Free+ harcamaz); siteyle çelişmez çünkü site hiçbir şey saklamıyor.
- Ücretsiz kısım: `buildLocalPodcastScript` Swift'e + `AVSpeechSynthesizer` (tr-TR, iki ses perdesi), replik vurgusu.
- Sohbet arayüzü, replik ilerlemesi, karta çevir, paylaş (m4a).

**Zor noktalar**
- **Boyut:** 24 kHz 16 bit tek kanal WAV ≈ 48 KB/sn ≈ 2,9 MB/dk; base64 %33 büyütür. Tek istekte 2,5 dakikalık podcast ~9 MB base64 olurdu, Vercel'in 4,5 MB cevap sınırını aşar. Bu yüzden 600 karakter (~40 sn, ~2-2,7 MB base64) parçalama zorunlu; parça sınırı sitedekiyle aynı kalmalı (aynı `partStartLines` hesabı).
- **Biçim:** site cevabı WAV sayıyor (`mimeType` varsayılanı `audio/wav`). Gemini TTS bazen ham PCM (`audio/L16;codec=pcm;rate=24000`) döndürür; iOS ilk 4 baytta `RIFF` yoksa 44 baytlık WAV başlığını kendisi eklemeli (oran mimeType'tan). Canlı yanıtla denenmeli.
- **Süre ve kesilme:** ~50 sn boyunca 4 istek; kullanıcı uygulamayı arka plana atarsa URLSession isteği kesilebilir. Üretim sırasında `beginBackgroundTask` ile kısa süre tanınmalı; ses hazırken arka planda çalma ayrı (audio modu).
- **Kota:** bir podcast = 1 (senaryo) + parça sayısı (~3) = ~4 Free+ hakkı (günde 30). Önbellek bunu her dinleyişte tekrar harcamayı önler.
- Site ile paylaşılmıyor (site de saklamıyor). Senaryo bile cihazlar arası değil.

**Büyüklük:** Büyük (yaklaşık 2-3 oturum: 1 oturum ses hattı ve oynatıcı, 1 oturum sohbet ekranı + ücretsiz cihaz sesi + önbellek, gerekirse 1 oturum cihazda deneme ve kilit ekranı).

### Önerilen sıra
1. **Akıllı arama.** En küçük ve risksiz: medya yok, 4,5 MB derdi yok, Free+ hakkı harcamaz, saklaması basit. Aynı işle Premium dışı "ders içi arama" açığı da kapanır. Bitince Premium metnine "Akıllı arama" geri girer.
2. **Görseller.** Tek istek, tek dosya; filigran ve cihazda saklama net. Önce ücretsiz "Görsel & Şema" sekmesinin iskeleti (kavram haritası + poster), sonra AI görsel aynı sekmeye; böylece Premium kilidi sitedeki gibi sekmenin içinde durur.
3. **Sesli not.** En büyük iş (parçalama, WAV/PCM, arka plan sesi, kilit ekranı, önbellek) ve gerçek cihazda dinleyerek denenmesi gerekiyor. Önce ücretsiz cihaz sesi + yerel senaryo (Premium dışı eşitlik), sonra stüdyo sesi.
Gerekçe: her adım kendi başına App Store'a çıkabilir ve metne eklenebilir; küçükten büyüğe gitmek, metni en kısa sürede siteyle eşitler. Kullanıcı "en çok satan" özelliği öne almak isterse sesli not 1. sıraya alınabilir; maliyeti değişmez, yalnızca ilk görünür sonuç 2-3 oturum gecikir.

### Premium dışı eşitlik açıkları (sitede var, iOS'ta yok; yalnızca liste)
| Özellik (site) | Büyüklük |
|---|---|
| Ders içi sıradan arama + etiket süzgeci (`CourseDetail.tsx`, `searchNotesSemantic`) | Küçük (akıllı aramayla birlikte yapılırsa ek iş yok) |
| Not → Araçlar → **Hafıza kodlaması** (`memory` görevi, akrostiş/tekerleme/hikâye; `MemoryTabs.tsx`, `memoryTools.ts`) | Orta |
| Not → Araçlar → **Karşılaştırma** (aynı `memory` görevi, `mode: comparison`) | Küçük (hafıza kodlamasıyla birlikte) |
| Not → Araçlar → **Görsel & Şema**'nın ücretsiz kısmı (kavram haritası, kör mod, Fosforlu poster; `visualTools.ts`) | Orta |
| Not → Araçlar → **Podcast**'in ücretsiz kısmı (yerel senaryo + cihaz sesi; `podcastTools.ts`) | Orta (sesli notun parçası) |
| Kart turu: "Son cevabı geri al" (`bump_study_day` negatif), "Yalnızca zorlandıklarım", "Sesli oku" (`Review.tsx:78, 197`) | Küçük |
| Geçmiş prova sonucunu açma ve soru-not eşleşmesi (`ExamHistory.tsx`, `ExamReview.tsx`) | Orta |
| Öğrenci tipi testi (`StudentQuiz.tsx`, `studentType.ts`; şu an sitede açılıyor) | Orta |
| **Mini oyunlar** (Günün Kavramı, Çekmece, Kâğıt top; `MiniGames.tsx`, `wordGame.ts`, `miniGames.ts`). Not: sitede VIP/Premium'a özel (`Mola.tsx:50`), yani bu da bir Premium aracı; çalışınca Premium metnine girebilir | Büyük (3 oyun) |
| Rehber (`Guide.tsx`; satın alma/kod bölümleri uygulamada çıkarılmalı) | Küçük-Orta |
| Not birleştirme (`mergeNotes.ts`) | Küçük-Orta |
| Dönem planlayıcı (`SemesterEditor.tsx`, `planSemester`) | Orta (iOS'taki sınav düzenleyiciyle örtüşmesi kontrol edilmeli) |
| Çalışma sesleri ve kırtasiye seti (`ambience.ts`, `DecorSettings.tsx`, `sound.ts`) | Orta (isteğe bağlı, görsel/dokunsal) |
Bilerek yok (karar): kendi yapay zekâ anahtarı, Premium kodu (`/kod`, RedeemLink), Fiyatlar, Yönetim.

## Devir notu (Claude, iPhone rolü — 28 Kasım): Tur 2
**Yapılan**
- Görev 1: yukarıdaki "Premium araçları: site ile eşitlik analizi" (kod yok).
- `MainTabs.swift` (Hesap, eski 192-196): "studymode.fun'u aç" bağlantısı kaldırıldı (kullanıcı onayı).
- `Config.swift:12-17`: `Config.sitePage(_:)` → `https://studymode.fun/<yol>?app=ios`. Kullananlar: `Settings/SettingsView.swift:107-108` (Gizlilik, Kullanım koşulları), `Premium/PremiumView.swift:841` (Gizlilik), `Mola/MolaView.swift:68` (öğrenci tipi), `Auth/LoginView.swift:223, 225` (Markdown bağlantılarına elle `?app=ios`). Siteye giden başka bağlantı yok (kalanlar API çağrısı, e-posta yönlendirmesi, Turnstile tabanı ve paylaşım bağlantısı).
- `Premium/PremiumStore.swift` `refresh()`: StoreKit kayıtları yalnızca `appAccountToken == oturumdaki kullanıcı` ise sayılıyor (abonelikler ve 2 haftalık paketler). Başka hesaba ait etkin abonelik `otherAccountSubscription` ile işaretleniyor; bu hesaba Premium göstermiyor (`.none` ya da sunucuda Premium varsa `.account`). `handle()`: başka hesabın işlemi gönderilmiyor ve bitirilmiyor (o hesap girince gider). Yeni `subscriptionUntil` (aboneliğin kendi yenileme tarihi).
- `PremiumView.swift` statusLine (`:315-317`): `.subscription` durumunda tarih `subscriptionUntil ?? storeUntil` (max değil). `:77-83`: plan listesinin altında "Bu Apple hesabındaki abonelik başka bir StudyMode hesabına bağlı" uyarısı (yalnızca `.none` + yabancı abonelik).
- `PremiumStore.stop()`: `activeSubscription`, `willRenew`, `subscriptionUntil`, `otherAccountSubscription` da sıfırlanıyor.
- "14 gün ekle" yerinde (kullanıcı kararı). Premium metnine bir şey eklenmedi. Adım tablosundaki Premium satırı güncellendi (#134 birleşti; `api/apple-notifications.ts` main'de).

**Kararlar**
- `appAccountToken`'ı olmayan eski işlem **sayılmaz**: sunucu onu `403 wrong_account` ile reddediyor, cihazda sayılsa site ve yapay zekâ hakları vermediği hâlde uygulama Premium gösterirdi. Bu uygulamadaki her satın alma ilk günden token taşıyor; tokensız işlem ancak uygulama dışından (App Store'da teklif kodu, öne çıkarılan satın alma) gelebilir. Böyle bir işlem `handle()`'da yine sunucuya gönderiliyor (sunucu karar verir, ret gelirse bitirilir).
- Başka hesabın işlemi bitirilmiyor: bitirilirse o hesap bu cihazdan bir daha gönderemezdi (sunucu Apple bildirimlerinden de alıyor, ama çift yol daha güvenli).
- Yenileme tarihi için `storeUntil` yerine `subscriptionUntil`: `storeUntil` 2 haftalık paketlerle birleşik maksimum, aboneliğin yenileme günü değil.

**İşe yaramayan**
- Yok. Gerçek iki hesaplı StoreKit denemesi yapılmadı (sandbox ve iki StudyMode hesabı gerekiyor).

**Sıradaki**
- Kullanıcı sırayı onaylarsa: 1) akıllı arama + ders içi arama, 2) Görsel & Şema sekmesi + AI görsel, 3) sesli not. Her biri çalışınca Premium metnine geri eklenir.
- Site: `?app=ios` ile Fiyatlar/Premium/Shopier bağlantılarının gizlenmesi (bu tur site rolünde). Yayına girince Gizlilik/Koşullar/öğrenci tipi sayfası uygulamadan açılıp denenmeli.
- Sandbox: aynı Apple hesabında iki StudyMode hesabıyla abonelik → ikinci hesapta Premium görünmemeli, uyarı çıkmalı.
