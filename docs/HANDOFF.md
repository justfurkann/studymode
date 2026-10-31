# StudyMode — Devir Notu (Claude Code oturumu, son güncelleme 31 Ekim 2026)

Bu dosya, Claude Code ile yapılan uzun bir çalışma oturumunun özetidir. Yeni bir oturuma (Claude Code veya Google AI Studio) bağlam vermek için yazıldı.

---

## 1. Ürün

**StudyMode**: Türk üniversite öğrencileri için ders çalışma uygulaması. Ders notunu (PDF, Word, PowerPoint, TXT, MD, fotoğraf, taranmış PDF) yükle; özet, kart, test, açık uçlu soru ve sınav provası oluşsun; aralıklı tekrar ve sınav tarihine göre plan yapılsın.

- **Ürün vaadi:** "Ders notlarını yükle, sınavına gerçekten hazır olup olmadığını öğren."
- **Hedef kitle şimdilik:** Kurucunun arkadaş çevresi (küçük ölçek).
- **Canlı adres:** https://studymode.fun (Vercel). Eski adres https://studymode-five.vercel.app hâlâ çalışıyor, ama bazı Türk internet sağlayıcıları `*.vercel.app`'i engelliyor; kendi alan adı bu yüzden alındı.

## 2. Altyapı ve hesaplar

| Parça | Durum |
|---|---|
| **GitHub** | `justfurkann/studymode`. Claude'un çalışma dalı: `claude/dreamy-sagan-5di1al`. `main` canlıya çıkar. |
| **Vercel** | `main`e gelen her birleştirme otomatik yayınlanır. Ortam değişkenleri: `GEMINI_API_KEY` (var), isteğe bağlı `GEMINI_MODEL`, `GEMINI_FALLBACK_MODELS`. |
| **Alan adı** | `studymode.fun`, Hostinger'den alındı; DNS Hostinger'de, Vercel'e bağlı. |
| **Supabase** | Proje kimliği `jpcatyopkpnudgdyncas`. Adres ve **publishable** anahtar `src/lib/config.ts` içinde (tarayıcıya açık olması normal; güvenliği RLS sağlar). Auth: e-posta + şifre, e-posta onayı açık. Site URL / Redirect URLs: `https://studymode.fun`. |
| **E-posta** | Resend üzerinden özel SMTP (`smtp.resend.com`, gönderen `noreply@studymode.fun`, ad "studymode"). Onay ve şifre sıfırlama şablonları Türkçe. |
| **Yapay zekâ** | Varsayılan: sunucudaki ortak **ücretsiz Gemini** (`/api/generate`, giriş zorunlu). Kullanıcı isterse kendi Claude / ChatGPT / Gemini anahtarını bağlar (anahtar yalnızca tarayıcıda, `localStorage`). Gemini model sırası: `gemini-3.5-flash-lite` → `gemini-flash-lite-latest` → `gemini-3.1-flash-lite` (yoğunlukta tekrar deneme ve yedek modele geçme var). |

**Güvenlik notları**
- Google AI Studio projesine **asla faturalandırma bağlanmayacak**. "Kota dolarsa yalnızca hata, para çıkmaz" güvencesi buna dayanıyor.
- Sohbette bir kez Supabase **secret** anahtarı (`sb_secret_…`) paylaşıldı. Kullanıcıya iptal etmesi söylendi; iptal edildiği **teyit edilmedi**. Kontrol edilmeli: Supabase → Project Settings → API Keys.
- Secret / service_role anahtarları koda, `.env`'e ya da sohbete asla konmaz.

**Claude'un doğrudan erişimi (1 Kasım 2026'da fark edildi):** Oturumda **Supabase** ve **Vercel** bağlantıları (MCP araçları) var; ToolSearch ile `supabase` / `vercel` aranınca yüklenir.
- Supabase proje kimliği `jpcatyopkpnudgdyncas`: tablo ve politika kontrolü, `get_advisors` güvenlik taraması, SQL çalıştırma.
- Vercel proje `prj_MKBVUckUIIar9RINW2u77MmYraGb`, ekip `team_0hA1FTe7Vn1ou2ld6IwpEAxf` (justfurkan): yayın durumu (`list_deployments`), canlı hatalar (`get_runtime_errors`). Ekip erişim onayı 1 Kasım'da verildi; süresi biterse `authorize_team_access` ile yeni onay bağlantısı üretilip kullanıcıya verilir.
- **Kullanıcı kararı (seçenek A):** Veritabanı değişikliklerini Claude çalıştırır, ama **her SQL'i önce kullanıcıya gösterip "tamam" aldıktan sonra.** Onaysız şema değişikliği yok. Salt okuma (kontrol, tarama, kayıt okuma) serbest.
- Her birleştirmeden sonra Vercel'de yayının READY olduğu kontrol edilir.
- Supabase güvenlik taramasında kalan uyarılar: `get_course_share` için iki "security definer anon/authenticated" uyarısı **bilinçli** (önizleme için gerekli; yalnızca tam token ile tek satır döner). "Leaked password protection" kapalı; kullanıcıya açması önerildi (planına bağlı olabilir).
- 1 Kasım kontrolü: son 4 production yayını READY. Son 7 günde yalnızca 29 Ekim akşamı eski bir yayında `/api/generate` 300 sn zaman aşımı ve Gemini 503 hataları var; sonraki zaman aşımı ve yedek model düzeltmeleriyle (`maxDuration = 60`, deneme başına zaman aşımı) çözülmüş, o tarihten beri hata yok.

## 3. Teknoloji ve kod yapısı

React 19 + TypeScript + Vite 7, React Router 7, Supabase JS, Anthropic SDK, zod 4, pdf.js, fflate (Office dosyaları), lucide-react ikonları, yazı tipleri Bricolage Grotesque (başlık) ve Figtree (gövde) — `@fontsource-variable`. Sürümler `package.json`'da sabit (`^` yok). Google AI Studio `package-lock.json`'ı sürekli siliyor; sürümler sabit olduğu için sorun değil, lockfile commit'lenmiyor.

```
api/generate.ts          Vercel fonksiyonu: oturum doğrulama, sabit görevler (study, exam, grade, transcribe, explain), Gemini çağrısı
src/lib/ai/              tasks.ts (talimatlar + zod şemaları, sunucuyla ortak), index.ts (sağlayıcılar, uzun not bölümleme), gemini.ts
src/lib/store.tsx        Tüm veri işlemleri (yerel/Supabase), seri sayımı
src/lib/backend.ts       Yerel depolama + Supabase; OPTIONAL_TABLES ve OPTIONAL_COLUMNS (tablo/sütun yokken çökmez)
src/lib/                 srs.ts (aralıklı tekrar), streak.ts, learningPath.ts (5 adım, hâkimiyet), studyPlan.ts, exam.ts,
                         examSession.ts, examPlan.ts (prova planı, cihazda), cardHint.ts, practice.ts, importNote.ts, officeText.ts,
                         auth.ts, settings.ts, courseExams.ts (vize/final), useDemo.ts, demo.ts
src/pages/               Landing (tanıtım, / ve /tanitim), Today, Courses, CourseDetail, NoteDetail, AddNote, Review,
                         ExamHub (/sinav sekmesi), Exam (/ders/:id/sinav), ExamHistory, Settings, Login, ResetPassword
src/styles/global.css    Tek stil dosyası; en üstte tema değişkenleri (aydınlık + karanlık)
src/components/          Brand (logo), Layout, ui, CourseForm, ExamReview, AiSignupPrompt, Welcome, NoteEditor, note/{Summary,Cards,Quiz,Practice}Tab
supabase/schema.sql      Tüm tablolar; tekrar çalıştırılabilir ("if not exists")
tests/app.spec.ts        Playwright uçtan uca testleri
```

**Her değişiklikten önce çalıştırılacaklar** (hepsi geçmeden gönderilmez):
```
npm test
npm run build
npx tsc -p tsconfig.api.json
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium npm run test:e2e   # Claude'un bulut ortamında
```
Son yeşil durum (Aşama 9 sonrası): 153 birim testi, 50 tarayıcı testi.

## 4. Veritabanı

Tablolar: `courses`, `notes`, `cards`, `quiz_attempts`, `exam_results`, `study_days`, `course_exams` (hepsi `user_id` + RLS "own rows").

**Çalıştırıldı (kullanıcı teyit etti, Ekim 2026):** ilk şema, `exam_results`, `study_days`, `quiz_attempts.answers`, `study_days.actions`, `course_exams`.

**Aşama 9 SQL'i de çalıştırıldı (1 Kasım 2026):** `course_shares` + `get_course_share`; Claude Supabase üzerinden teyit etti (tablo, RLS, politika, fonksiyon yerinde). Bekleyen SQL yok.

**Kayıt için (artık çalıştırıldı):**
```sql
alter table public.quiz_attempts add column if not exists answers jsonb;
alter table public.study_days add column if not exists actions integer not null default 0;
```


## 5. Alınan kararlar

- **Yapay zekâ:** Ücretsiz ortak Gemini varsayılan, giriş zorunlu (kötüye kullanımı sınırlıyor). Misafirlere "Yapay zekâ ücretsiz, sadece hesap aç" daveti gösteriliyor. Kendi anahtarını getirme seçeneği duruyor.
- **Basit mod** (kural tabanlı, yapay zekâsız) geliştirilmeyecek; insanları hesap açmaya yönlendirmek daha verimli.
- **Kullanıcı başına yapay zekâ kotası:** Konuşuldu, ama son hedefte kapsam dışı bırakıldı. Arkadaşlara açılınca adalet için gerekli olabilir (tasarım önerisi: sunucuda `ai_usage` tablosu, kullanıcı silemez/güncelleyemez, `AI_DAILY_LIMIT` ortam değişkeni, uzun notun bölümlerini ayrı ayrı say).
- **Seri (Duolingo mantığı):** Her çalışma seriyi sürdürür (kart, test/sınav, yazılı cevap, gerçek yapay zekâ açıklaması → `study_days.actions`). Günlük **kart hedefi** yalnızca kart tekrarlarını sayar.
- **Tasarım/marka yenilemesi: ✅ yapıldı ("Fosforlu" yönü, Aşama 4).** Ayrıntılar ve kurallar için aşağıdaki "Tasarım dili" bölümüne bak. Yeni ekranlar bu kurallara uymalı.
- **Çalışma düzeni:** Claude PR açıp kendisi birleştirebilir (kullanıcı izin verdi). Google AI Studio da `main`e doğrudan gönderiyor; AI Studio bir şey yapınca kullanıcı Claude'a "güncelledim" der, Claude çekip test eder. İkisi aynı anda aynı dosyalara dokunmaz.
- AI Studio'ya verilen kurallar: commit'ten önce testler; sürümler sabit; şema değişikliği `schema.sql`'e "if not exists" ile ve kullanıcıya ayrı SQL; tablo yokken uygulama çökmemeli; `api/generate.ts`, `backend.ts`, `store.tsx` senkron kısmı, `schema.sql`, auth dosyaları Claude'da.
- Arayüz dili sade Türkçe; sayıya ek gerektiren ifadelerden kaçınılır ("%40'ına" değil, "Pekiştirilen kartlar: %40").

## 6. Birleştirilmiş PR'lar (özet)

#2 baştan yazım · #3 Supabase bağlantısı · #4 e-posta doğrulama mesajı · #5 toplu dosya yükleme · #6 ortak ücretsiz yapay zekâ + kendi anahtarı · #7 sınav provası · #8–#9 dosya ekleme, teşhis uç noktası · #10 Gemini yeniden deneme/yedek model · #11 lockfile, README · #12 Türkçe dosya adı indirme hatası · #13 README adresi · #14 ad-soyad, şifre tekrarı, şifremi unuttum · #15 öğrenme yolu testleri · #16 sınav geçmişi, hazırlık durumu, Word/PowerPoint, yeni kullanıcı akışı · #17 taranmış PDF istek boyutu, aynı günde seri toplamı · #18 Aşama 1 · #19 Aşama 2 (vize/final) · #20 Aşama 3 (not sayfasında tek çalışma akışı) · #21 Aşama 4 (Fosforlu tasarım + tanıtım sayfası) · #22 Aşama 5 (Sınav provası sekmesi) · #23 Aşama 6 (boşluk doldurma) · #24 devir notu · #25 Aşama 7 (Mola) · #26 Aşama 8 (Sınavlar sekmesi) · #27 Aşama 9 (ders paylaşımı). Hepsi `main`de ve canlıda.

## 7. Aşamalar ve durum

**Şu an açık bir hedef yok.** Aşama 1-9 bitti, hepsi canlıda. Sıradaki adım kullanıcının kararı; önerilen: arkadaşlarla bir hafta gerçek kullanım (bkz. 8. bölüm).

**Aşama 1 — Doğrulama ve hatalar: ✅ TAMAM (#18)**
- Uzun not: bölüm başına bir yeniden deneme, kısmi sonuç + uyarı, not eklemede bölüm ilerlemesi.
- Uygula: cevap ve değerlendirme kalıcı (otomatik kayıt), anlamlı cevap olmadan 5. adım tamamlanamaz; sekme her kayıtta sıfırlanıyordu, düzeltildi.
- Kartlar: "Hatırladım / Tekrar bakacağım" gerçek tekrar olarak kaydediliyor (hâkimiyet, günlük hedef, seri).
- Test: son sonuç ve yanlışlar geri dönünce görünüyor, "Tekrar çöz"; seçilen şıklar saklanıyor.
- Örnek ders: 7 gün sonrasına sınav tarihi.
- Sınav oturumu: bozuk kayıt temizleniyor, süresi dolan sınav otomatik teslim ediliyor, ders değişince karışmıyor.
- "Anlamadım": kavramın geçtiği bölüm gönderiliyor; yerel yedek açıkça belirtiliyor.
- `.aistudio/` depodan çıkarıldı.

**Aşama 2 — Vize/final/bütünleme: ✅ TAMAM (Aşama 2 PR'ı)**
- Veri modeli `CourseExam` (`types.ts`), yardımcılar `src/lib/courseExams.ts` (geri sayım "Vizeye 8 gün", ders adıyla "Biyoloji vizesine 8 gün kaldı", kapsam, en yakın sınav).
- `store.saveCourseExams`, `backend.ts` → `course_exams` (OPTIONAL_TABLES: tablo yoksa çökmez, sınavlar o oturumda görünür ama buluta yazılmaz; `courses.exam_date` en yakın sınavı tutmaya devam eder).
- Ders formu: sınav listesi (tür, tarih, ağırlık %, "Diğer" için ad, kapsam için not seçimi).
- Ders sayfası "Sınavlar" bölümü (geri sayım, tarih, ağırlık, kapsam, o sınav için "Prova"); 3'ten az not ve etiket yoksa arama satırı gizli.
- Dersler kartı, Bugün "Yaklaşan sınavlar" her sınavı ayrı gösterir; akıllı plan her notu kendisini kapsayan sınava göre önceliklendirir, başlık önerilen konuların sınavından bahseder (başka dersin sınavı hatası düzeltildi).
- Kart aralığı (hem kayıtta hem tekrar ekranı önizlemesinde) notu kapsayan en yakın sınavla sınırlı.
- Sınav provası: "Hangi sınava hazırlanıyorsun?" seçimi kapsamdaki notları otomatik seçer. Sınav incelemesinde her soru için "Kaynağında gör" (notun Kaynak sekmesinde alıntı vurgulanır, `?sekme=kaynak&alinti=…`).
- Örnek ders: 7 gün sonra, %40 ağırlıklı bir Vize.
- **Uyumluluk kararı:** `courses.exam_date` silinmez/dönüştürülmez; sınav kaydı yoksa sanal "Sınav" gösterilir; sınavlar kaydedilince `exam_date` en yakın sınavı tutar.
- SQL (kullanıcı çalıştırdı):
```sql
create table if not exists public.course_exams (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  kind text not null check (kind in ('vize', 'final', 'butunleme', 'quiz', 'diger')),
  title text check (title is null or char_length(title) <= 80),
  "date" date not null,
  weight real check (weight is null or (weight >= 0 and weight <= 100)),
  note_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists course_exams_user_idx on public.course_exams (user_id, course_id);
alter table public.course_exams enable row level security;
drop policy if exists "own rows" on public.course_exams;
create policy "own rows" on public.course_exams for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
```

**Aşama 3 — Çalışma ekranı UI/UX: ✅ TAMAM (Aşama 3 PR'ı)**
- Not sayfası: roadmap kutusu + iki metrik kartı + 5 sekme kaldırıldı; yerine tek adım çubuğu **Özet · Test · Kartlar · Anlat** (`role=tablist`, tamamlanan adımda ✓, önerilen adımın numarası vurgulu). Kaynak metin "⋯" menüsünde (`?sekme=kaynak` hâlâ çalışır).
- Sayfaya girince doğrudan sıradaki adım açılır; bu seçim not başına bir kez yapılır, tur ortasında adım tamamlanınca ekran zıplamaz.
- Öğrenme yolu sırası değişti: tanis → anla → **sina (Test)** → **pekistir (Kartlar)** → anlat. Test seviyeyi ölçer; herhangi bir puanla bitirmek adımı tamamlar (düşük puan hâkimiyette ve günlük planda görünür).
- Üst bilgi tek satır: tür · "%60 tamamlandı" · (ölçüldüyse) "Hâkimiyet %40" · etiketler. Kelime sayısı Kaynak görünümünde.
- "⋯" menüsü: Kaynak metin, Notu düzenle, Özeti düzenle, Yeniden hazırla, Özeti kopyala, Markdown indir, PDF/Yazdır (özet görünümüne geçip yazdırır), Notu sil.
- Özet: "Kavramlar / Ana noktalar" anahtarı, uzun açıklama paragrafları yok; son madde "Teste geç".
- Test: ilk açılışta tek satır açıklama; sonuçta "Tekrar çöz", "Yanlışlarımı karta çevir", "Kartlarla pekiştir →".
- Kartlar: tek kart akışı — soru → **İpucu** (cevaptan türetilir: kısa cevapta "M_________", uzun cevapta ilk kelimeler; `src/lib/cardHint.ts`) → **Çevir** → **Tekrar / Bildim** → sonraki. "Tekrar" denen kart turun sonuna döner. Tur sonunda "6 kartın 5 tanesini ilk denemede bildin" (emoji Aşama 4'te onay rozetine döndü). Kart listesi, Kart ekle ve "Tekrar ekranında çalış" kapalı **"Kartları yönet (N)"** çekmecesinde. Klavye: boşluk çevirir, 1 Tekrar, 2 Bildim.
- Anlat: tek satır yönerge, "Bitir: Konuyu öğrendim", bitişte "Bu notu bitirdin!".
- Ölü CSS temizlendi (roadmap, metrik kartı, eski kart eğitmeni; ~336 satır).

**Aşama 4 — Görsel tasarım yenilemesi: ✅ TAMAM (Aşama 4 PR'ı)**
- Kullanıcıya üç yön sunuldu (A Fosforlu, B Kütüphane, C Pati); **A seçildi**.
- Giriş yapmamış ve hiç dersi olmayan ziyaretçi `/` adresinde artık uygulama yerine **tanıtım sayfasını** görür (`src/pages/Landing.tsx`); sayfa her zaman `/tanitim` adresinden de açılır. E-posta bağlantısı hatası varsa tanıtım yerine uygulama kabuğu açılır (hata mesajı görünsün diye).
- Giriş yapmış ama dersi olmayan kullanıcı için kısa ilk açılış ekranı (`Welcome.tsx`).
- Logo `src/components/Brand.tsx`; favicon ve `icon-192/512.png` yenilendi.
- Telefonda üstte "Misafir · Bu cihazda kayıtlı" şeridi yerine logo + "Giriş yap" / baş harf çubuğu.
- Emojiler kaldırıldı (🔥 → alev simgesi + son 7 gün şeridi, 🎉 → fosforlu onay rozeti).

**Aşama 5 — "Sınav provası" sekmesi: ✅ TAMAM (Aşama 5 PR'ı)** — arkadaş geri bildirimi: "Ders için sınavın nasıl olacağını gireyim, örnek sınav oluştursun."
- Menüde yeni sekme `/sinav` (`src/pages/ExamHub.tsx`): dersler, en yakın sınavı olan önce; geri sayım ve son prova puanı. Tıklayınca mevcut prova ekranı (`/ders/:id/sinav`) açılır. Telefonda alt menüde "Ayarlar"ın yerini "Sınav" aldı; Ayarlar üst çubukta (misafirde dişli simgesi, girişlide baş harfler).
- Prova ekranında "Sınav nasıl olacak?" bölümü: test ve klasik soru sayısı ayrı (format bunlardan çıkar), süre (120 dk'ya kadar), zorluk, "Hoca sınav hakkında ne dedi?" ve geçmiş sorular. Yapay zekâya `mcq`/`open` sayıları ve `<about_the_real_exam>` gider; `normalizeExam` her türden en fazla istenen kadarını tutar.
- Seçimler cihazda ders ve sınav başına hatırlanır (`src/lib/examPlan.ts`, `localStorage` anahtarı `studymode.examPlan.v1`). Veritabanı değişikliği yok, SQL gerekmez.

**Aşama 6 — Boşluk doldurma: ✅ TAMAM (Aşama 6 PR'ı)** — arkadaş geri bildirimi: sınavlarda test ve klasiğin yanında boşluk doldurma da var; kelime havuzunda hiçbir boşluğa uymayan fazladan kelimeler olur.
- Yeni soru türü `blank` (`ExamQuestion.type`): tek cümle, bir `_____`; `options` tüm boşlukların ortak kelime havuzu, `answerIndex` doğru kelime. Puanlama test gibi (tam ya da sıfır).
- Prova kurulumu: "Boşluk doldurma" (4-12) ve "Boşta kalacak kelime" (0-6, varsayılan 3). Yapay zekâ `blank` sorularını ve üst düzey `distractors` listesini döndürür; `normalizeExam` tek boşluklu olmayanları, tekrar eden cevapları ve fazladan kelime olarak cevapla aynı olanları atar, havuzu karıştırır ve soruları gerçek sınav sırasına koyar (test → boşluk → klasik).
- Sınav ekranı: havuz ilk boşluk sorusunun üstünde bir kez gösterilir, kullanılan kelimenin üstü çizilir; her cümlede satır içi seçim kutusu.
- Yalnızca yapay zekâ ile; "Hazır sorulardan karıştır" modunda boşluk doldurma yok. Veritabanı değişikliği yok (`exam_results.questions` jsonb; boşluklu sınavların türü `mixed`).

**Aşama 7 — Mola (eğlence bölümü): ✅ TAMAM (Aşama 7 PR'ı)** — kullanıcı isteği: "renk katacak, sade ama güzel, eğlenceli ufak şeyler". Rakip analizi sonrası kural: eğlence kullanıcının kendi kartlarından beslenir ya da çalışmayı ödüllendirir; konu dışı oyun yok, yapay zekâ harcanmaz.
- Yer: "Tekrar" sekmesinin üstünde "Tekrar | Mola" anahtarı (`/tekrar?bolum=mola`, oyun `&oyun=eslestir|hizli|odak`). Alt menü 5 öğede kaldı. Nottan/dersten açılan tekrarda (`?not=`, `?ders=`) anahtar görünmez.
- **Eşleştir:** 6 kart, 12 kutucuk, süreye karşı; yanlış eşleşme +2 sn. "“X” ne anlama gelir?" ön yüzleri kutucukta yalnızca "X" olur (`tileFront`). Rekor ders başına.
- **Hızlı tur:** 60 sn, gösterilen cevap doğru mu yanlış mı (yanlışlar başka kartın cevabı); üst üste üçüncü doğrudan itibaren 2 puan; klavye ←/→; sonda "Kaçırdıkların" listesi.
- **Odak defteri:** 25/50 dk sayaç; her dakika kareli sayfada bir kare boyanır. Başka sayfaya geçince/yenileyince sürer (`localStorage` `studymode.focus.v1`), tam oturum seriyi sürdürür, erken bitirilen dakikalar haftalık toplama eklenir. "1 dolu sayfa" = 25 dk.
- **Önemli kural:** Oyunlar seriyi sürdürür (`store.recordActivity`), ama aralıklı tekrar planına ve günlük kart hedefine **dokunmaz**.
- **Kutlama:** `Celebrate` bileşeni (`ui.tsx`): bitiş anında kelimenin altından fosforlu kalem bir kez geçer (kart turu, test sonucu, not bitişi, tekrar oturumu sonu, oyun sonuçları). Hareket azaltma tercihinde animasyonsuz.
- **Sesler:** Ayarlar → "Görünüm ve ses" → "Küçük sesler" (varsayılan kapalı). Ses dosyası yok, Web Audio ile kısa tonlar (`src/lib/sound.ts`).
- Mantık `src/lib/mola.ts` (+ testleri), ekran `src/pages/Mola.tsx`. Rekorlar ve odak dakikaları yalnızca cihazda (`studymode.mola.v1`). Veritabanı değişikliği yok, SQL gerekmez.
- Sonraki adım adayları (konuşuldu, yapılmadı): paylaşılabilir haftalık karne, çıkartma albümü, arkadaşla düello (veritabanı + RLS ister).

**Sesli not (rafa kaldırıldı, 1 Kasım 2026):** Araştırma sonucu: Gemini TTS modelleri (`gemini-3.8-flash-tts`, `-lite-tts`) resmî fiyat sayfasında ücretsiz katmanda ve Türkçe destekli; tek istekte 2 konuşmacılı "podcast" mümkün. NotebookLM'in açık API'si yok. ElevenLabs ücretsiz planı ayda ~10 bin karakter ve ticari kullanım yok, uygun değil. Kısıtlar: ücretsiz kota belirsiz ve düşük olabilir (kullanıcı başına kota gerekir); WAV dosyası büyük (1 dk ≈ 2-3 MB, Vercel cevap sınırı ~4,5 MB), parçalama ya da düşük örnekleme gerekir. Kullanıcı "boşverelim, başka şeylere efor harcayalım" dedi. İstenirse buradan devam edilir.

**Aşama 8 — "Sınavlar" sekmesi: ✅ TAMAM (Aşama 8 PR'ı)** — kullanıcı isteği: bütün derslerimi ve sınav tarihlerini tek seferde gireyim, dersler oluşsun; uygulama aciliyete göre "şimdi bununla başla" desin.
- "Sınav provası" sekmesi **"Sınavlar"** oldu (`/sinav`; yan menü ve alt menü adı değişti). Sırayla: "Sınav ekle" düğmesi → **Dönemini kur** tablosu, "Şimdi bununla başla" kartı, **Takvim** (bütün yaklaşan sınavlar tarih sırasıyla, 3 gün ve altı fosforlu tarih kutusu, ağırlık, hazırlık %), tarihi olmayan dersler, katlanır "Geçmiş sınavlar", en altta eski prova listesi (aynen).
- Hiç ders ya da yaklaşan sınav yoksa sekme doğrudan Dönemini kur tablosuyla açılır.
- **Dönemini kur** (`SemesterEditor.tsx`): satır başına ders adı, vize, final. Yeni ad → yeni ders (+ sınavları); mevcut ad (büyük/küçük harf, boşluk farkı yok sayılır) → ilk vize/final tarihi güncellenir ya da eklenir. Bütünleme, quiz, ağırlık, kapsam ve ikinci vize olduğu gibi kalır; **boş hücre hiçbir sınavı silmez.** Mevcut dersler salt okunur satır olarak gelir.
- **Şimdi bununla başla** (`ExamFocusCard.tsx`, Bugün sayfasında ve Sınavlar'da): 45 gün içindeki sınavlar arasında aciliyet = (1 − hazırlık) × ağırlık katsayısı / (gün + 1). Hazırlık, sınavın kapsadığı notların hâkimiyet ortalaması; test ya da kart tekrarı olmayan not en fazla %40 sayılır; notu olmayan derste hazırlık "bilinmiyor" ve eylem "Not ekle" (`/not-ekle?ders=…`). %85 ve üstü hazır sınavlar öne çıkarılmaz. Eylem akıllı plandaki o sınava ait ilk not; hepsi çalışılmışsa "Prova yap".
- **Telefon takvimine ekle:** `.ics` dosyası (tüm gün etkinlik, bir gün önce 09:00 hatırlatma). Bildirim altyapımız olmadığı için hatırlatmayı telefonun takvimi yapar.
- Dersler sayfası: notu olmayan derste "Not ekle" etiketi; hiç ders yokken "Bütün dönemi tek seferde gir".
- Mantık `src/lib/examFocus.ts` (+ testleri). Veritabanı değişikliği yok, SQL gerekmez.

**Aşama 9 — Ders paylaşımı (link + QR): ✅ TAMAM (#27), SQL çalıştırıldı, kullanıcı canlıda denedi** — kullanıcı isteği: arkadaşla dersi link ya da QR ile paylaşmak. Karar: **kopya** yöntemi (canlı ortak ders değil).
- Ders sayfasında "Paylaş" → `ShareCourse.tsx` penceresi. Ders bir **anlık kopya** (snapshot) olarak `course_shares` tablosuna yazılır, 22 karakterlik tahmin edilemez bağlantı (`/paylas/<token>`) üretilir; kopyala, telefonun paylaş menüsü, QR kod (`qrcode-generator` 1.4.4, sarı zemin + lacivert; iki temada okunur). "Dersin şimdiki hâliyle güncelle" (aynı bağlantı) ve "Paylaşımı kapat" (satır silinir, bağlantı ölür). Giriş yapmamışsa bağlantı oluşturamaz.
- Anlık kopyada **yalnızca içerik** var: notlar, temiz özet (overview/points/keyTerms/tags), sorular, model cevaplı açık uçlu sorular, kartlar (ön/arka/kaynak), **yaklaşan** sınav tarihleri. **Gitmeyenler:** kart ilerlemesi, tamamlanan adımlar, işaretli kavramlar, yazılı cevap taslakları ve puanları, test denemeleri, sınav sonuçları, e-posta (sahip adı yalnızca ad soyad; ad yoksa boş). Sınır 2,5 MB.
- Arkadaş `/paylas/<token>` açar (`SharedCourse.tsx`): önizleme (kim paylaştı, not/kart/soru/sınav sayıları, içindekiler), "Derslerime ekle" → `store.importCourse` tek seferde yeni kimliklerle, sıfır ilerlemeyle kopyalar (aynı adlı ders varsa "(paylaşılan)" eki). Misafir de ekleyebilir (yalnızca bu cihaza). Aynı cihazda tekrar açılırsa "Bu dersi daha önce ekledin · Derse git".
- Güvenlik: tabloda yalnızca sahip RLS'i; başkası listeleyemez/değiştiremez. Okuma yalnızca tam token ile `security definer` fonksiyon üzerinden (anon + authenticated). Yerel Postgres 16'da sahte Supabase auth ile denendi: başkası 0 satır görür/günceller/siler, yanlış ya da `%` token boş döner, başkası adına ekleme RLS'e takılır, kısa token kısıtlamaya takılır, ders silinince paylaşım da silinir; şema iki kez üst üste çalıştırılabiliyor.
- Kod: `src/lib/share.ts` (snapshot, zod doğrulama, token, Supabase çağrıları; + testleri), `store.importCourse`.
- SQL (`schema.sql` sonunda da var):
```sql
-- Shared courses: a snapshot of one course behind an unguessable link (Aşama 9).
-- Owners manage their own rows; nobody can list shares. A friend reads one only by its exact
-- token, through get_course_share below.
create table if not exists public.course_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid references public.courses (id) on delete cascade,
  token text not null unique check (token ~ '^[A-Za-z0-9]{16,64}$'),
  title text not null check (char_length(title) between 1 and 120),
  owner_name text check (owner_name is null or char_length(owner_name) <= 80),
  snapshot jsonb not null check (octet_length(snapshot::text) <= 3000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists course_shares_user_idx on public.course_shares (user_id, course_id);
alter table public.course_shares enable row level security;
drop policy if exists "own rows" on public.course_shares;
create policy "own rows" on public.course_shares for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.get_course_share(share_token text)
returns table (title text, owner_name text, snapshot jsonb, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.title, s.owner_name, s.snapshot, s.updated_at
  from public.course_shares s
  where s.token = share_token
  limit 1;
$$;
revoke all on function public.get_course_share(text) from public;
grant execute on function public.get_course_share(text) to anon, authenticated;
```

## Tasarım dili ("Fosforlu")

Fikir: "Notunu yükle, önemlisini biz işaretleyelim." Kareli defter zemini, lacivert mürekkep, tek parlak renk olarak fosforlu sarı.
- **Renkler** `src/styles/global.css` başındaki değişkenlerde; bileşenlerde sabit renk yazma. Aydınlık: zemin `#fafaf6`, mürekkep `#1b2250`, fosforlu `#ffe14d`. Karanlık: gece laciverti `#11142a`, metin `#f4f3ea`, fosforlu aynı.
- **Sarı yalnızca zemindir**, asla yazı rengi değil (beyaz üstünde okunmaz). Sarının üstündeki yazı her zaman `--on-hi` (lacivert).
- **Vurgu kelimesi:** `<span className="hl">kelime</span>` fosforlu kalem gibi işaretler. Başlıkta en fazla bir kelime.
- **Basılabilir görünüm** (lacivert çerçeve + alt gölge) yalnızca ana eylemde (`btn-primary`) ve odak kartlarında (çalışma kartı, test kartı, giriş kartı, ilk açılış). Listeler ve diğer paneller sade kalır.
- **Yazı tipleri:** başlıklar `--font-display` (Bricolage Grotesque, 700-800, sıkı harf aralığı), gövde `--font-body` (Figtree).
- **Emoji kullanma**; gerekiyorsa lucide simgesi.

## 8. Kullanıcının elle denemesi gerekenler (henüz teyit edilmedi)

- **Gerçek Gemini ile sınav provası:** "Hoca ne dedi?" metninin dikkate alınması, test/klasik/boşluk sayılarına uyulması, boşluk cümlelerinin anlamlı ve fazladan kelimelerin inandırıcı olması. Testler sahte yapay zekâ cevaplarıyla yapıldı; çıktı kalitesi hiç görülmedi.
- Uzun boşluk bölümünde (10-12) kelime havuzunun yukarıda kalması rahatsız ederse havuz ekranın üstüne sabitlenebilir.

- Fotoğraf ve taranmış PDF'ten not okuma, gerçek Gemini ile (hiç denenmedi).
- Yapay zekâ çıktı kalitesi, gerçek bir ders notuyla (sorular, Türkçe, uydurma bilgi var mı).
- Seri ve günlük hedefin iki cihazda doğru sayılması.
- "Şifremi unuttum" akışının gerçek e-postayla uçtan uca çalışması.
- Secret anahtarın iptal edildiğinin teyidi.

## 9. Kullanıcıyla çalışma tarzı

- Türkçe, uzun ve analizli cevaplar ister; "üçüncü göz" gibi dürüst değerlendirme bekler, her zaman haklıymış gibi davranılmasını istemez.
- Teknik değil; adımlar tıklama tıklama, ekran görüntüsü istenerek anlatılmalı. Gizli anahtarları sohbete yapıştırabilir; anahtar türleri net ayrılmalı.
- Asıl önerilen yol: yeni özellik yığmadan önce 2-3 arkadaşla bir hafta gerçek kullanım ve geri bildirim.
