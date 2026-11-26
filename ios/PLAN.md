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
| — | Bilinen eksik (6): formül ağırlıklı PDF sayfalarını resim olarak okutma (sitedeki `mathPages`) yok; formüllü PDF'lerin metni bozuk çıkabilir | |
| — | Kart turu "karıştır" (`ReviewSession` sağ üst araç çubuğu), 3B kart çevirme + sağa/sola kaydırma damgaları (`BİLDİM` / `TEKRAR`), tüm iç ekranlarda (`CoursesView`, `CourseDetailView`, `NoteDetailView`, `QuizSection`, `NoteCardsSection`, `AddNoteView`, `ReviewTab`, `MainTabs`) "Fosforlu" animasyon kiti (`MotionKit.swift`: kayan fosforlu sekme çubuğu, iskelet yükleme, doğru/yanlış fiziksel tepkiler, Fosfor kutlama rozetleri, Hesap → "Açılış tanıtımını gör") | ✅ 26 Kasım (`son tekrarı geri al` hâlâ yapılacaklar listesinde) |
| — | Bugün (sitenin Today.tsx'i, "Çalışma masam" sekmesinde): selam + tarih, YKS/LGS geri sayımı (gizlenebilir), "Şimdi bununla başla" (`pickExamFocus` birebir), son 7 gün şeridi ve seri, akıllı plan (`buildSmartStudyPlan` birebir), adım adım devam, diğer sınavlar, zayıf konular, son notlar; her not bir kez görünür. Bağlantılar notu doğru adımda açar (`NoteRoute`). Adım 5 "Anlat" (PracticeTab): açık uçlu sorular, otomatik kaydedilen cevap (`notes.practice` ham JSON, yalnızca `draft`/`evaluation`), yapay zekâ puanlama (`grade`), örnek cevap, "Bitir: Konuyu öğrendim". `study_days` yazımları artık `bump_study_day` RPC ile | ✅ kodlandı 26 Kasım; giriş yapılmış ekranda henüz görülmedi |
| — | Not menüsü (sağ üst): Kaynak metin, Notu düzenle (başlık, ders, metin; metin değişince `summary.sourceChanged` ve uyarı), Yeniden hazırla, Özeti paylaş (Markdown), Notu sil (sınavların `note_ids`'inden çıkarılır, kartlar ve test sonuçları cascade ile gider). "Bu konuyu anlamadım" her kavramın ve ana noktanın altında (`explain`: daha basit, örnek, adım adım; notun ilgili bölümü `contextAround` ile). Tam özet sekmesi her zaman var: yoksa "Ayrıntılı özet hazırla" (`detail`, 12.000'lik parçalar sırayla, `summary.detailed`'e ham JSON ile), varsa yeniden yazma | ✅ kodlandı 27 Kasım; giriş yapılmış ekranda henüz görülmedi |
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
