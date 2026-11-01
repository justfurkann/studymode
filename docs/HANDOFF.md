# StudyMode — Devir Notu (Claude Code oturumları, son güncelleme 1 Kasım 2026)

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
- **Ücretsiz Gemini anahtarı:** Vercel ortam değişkeni `GEMINI_API_KEY` (Google AI Studio'da oluşturulmuş, faturasız projede). Kullanıcı 1 Kasım 2026'da tüm Google API anahtarlarını sildiğini söyledi; Vercel'deki değer yenisiyle değiştirilmeli (adımlar sohbette verildi). `GET https://studymode.fun/api/generate` yalnızca değişkenin *var olduğunu* söyler (`configured`), anahtarın geçerli olduğunu değil.
- Ayarlar'daki model alanı artık gerçek bir liste (`ModelPicker`, eski datalist yalnızca yazılı olanı gösteriyordu) + "Başka bir model (adını yaz)".
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
Son yeşil durum (1 Kasım 2026, Aşama 21 sonrası, `main` üzerinde): 239 birim testi, 93 tarayıcı testi.

**Kodu yalnızca bir Claude oturumu değiştirmeli.** 1 Kasım'da iki oturum (`dreamy-sagan`: Premium; `keen-albattani`: Aşama 14-19) aynı anda `main`e gönderdi; çakışma olmadan birleşti ama riskliydi. Bundan sonra tek oturum çalışsın; iş devredilecekse önce bu dosya güncellenip `main`e alınsın.

`package-lock.json` depoda yok (AI Studio sildiği için); `npm ci` çalışmaz, `npm install` kullanılır. Sürümler sabit olduğu için sorun değil.

## 4. Veritabanı

Tablolar: `courses`, `notes`, `cards`, `quiz_attempts`, `exam_results`, `study_days`, `course_exams` (hepsi `user_id` + RLS "own rows"), `course_shares` (sahip RLS + token ile okuma fonksiyonu), `feedback` ve `client_errors` (yalnızca ekleme; API'den okunamaz, Claude/sahip Supabase'den okur).

**Çalıştırıldı (kullanıcı teyit etti, Ekim 2026):** ilk şema, `exam_results`, `study_days`, `quiz_attempts.answers`, `study_days.actions`, `course_exams`.

**Aşama 9 SQL'i de çalıştırıldı (1 Kasım 2026):** `course_shares` + `get_course_share`; Claude Supabase üzerinden teyit etti (tablo, RLS, politika, fonksiyon yerinde).

**Aşama 10 SQL'i (`feedback`, `client_errors`) Claude tarafından kullanıcının isteğiyle canlıya uygulandı (1 Kasım 2026, migration `feedback_and_client_errors`).**

**Aşama 11 SQL'i (`user_roles`, `ai_usage`, kota ve yönetim fonksiyonları; kurucu hesabı yönetici) canlıya uygulandı (1 Kasım 2026, migration `roles_ai_quota_admin`).** Bekleyen SQL yok.

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

#2 baştan yazım · #3 Supabase bağlantısı · #4 e-posta doğrulama mesajı · #5 toplu dosya yükleme · #6 ortak ücretsiz yapay zekâ + kendi anahtarı · #7 sınav provası · #8–#9 dosya ekleme, teşhis uç noktası · #10 Gemini yeniden deneme/yedek model · #11 lockfile, README · #12 Türkçe dosya adı indirme hatası · #13 README adresi · #14 ad-soyad, şifre tekrarı, şifremi unuttum · #15 öğrenme yolu testleri · #16 sınav geçmişi, hazırlık durumu, Word/PowerPoint, yeni kullanıcı akışı · #17 taranmış PDF istek boyutu, aynı günde seri toplamı · #18 Aşama 1 · #19 Aşama 2 (vize/final) · #20 Aşama 3 (not sayfasında tek çalışma akışı) · #21 Aşama 4 (Fosforlu tasarım + tanıtım sayfası) · #22 Aşama 5 (Sınav provası sekmesi) · #23 Aşama 6 (boşluk doldurma) · #24 devir notu · #25 Aşama 7 (Mola) · #26 Aşama 8 (Sınavlar sekmesi) · #27 Aşama 9 (ders paylaşımı) · … · #48 Premium özellikleri (yalnızca VIP) · #49 Aşama 14 (çalışma fişi, ortam sesleri, gece kuşu, kırtasiye seti) · #50 Aşama 15 (site incelemesi düzeltmeleri) · #51 Aşama 16 (Tam özet) · #52 Aşama 17 (Hangi öğrenci tipisin?) · #53 Aşama 18 (Başarımlar) · #54 Aşama 13 (Premium sekmesi) · Aşama 19 (öğrenci tipi ve başarımlar profilde) bu dosyayla birlikte. Hepsi `main`de.

## 7. Aşamalar ve durum

**Şu an açık bir hedef yok.** Aşama 1-21 bitti, hepsi `main`de. Sıradaki adım kullanıcının kararı; önerilen: arkadaşlarla bir hafta gerçek kullanım (bkz. 8. bölüm).

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

**Mola 2 (kullanıcı geri bildirimiyle yenilendi, 1 Kasım 2026):** Kod `src/components/mola/` altında (`MatchGame`, `QuickGame`, `FocusTimer`, `FocusEngine`, `shared`); `src/pages/Mola.tsx` yalnızca menü ve Tekrar|Mola anahtarı.
- **Eşleştir:** iki sütun (solda "Kavram", sağda "Cevap"; `buildMatchColumns`). Seçilen kutu fosforlu; doğru çift yeşil + tik, **yerinde kalır** (kaybolup düzen kaymıyor); yanlış çift kırmızı titrer, +2 sn. İlerleme çubuğu ve "3/6 eşleşti".
- **Hızlı tur:** kart parmakla **sağa = doğru, sola = yanlış** kaydırılır (90 px eşik; sürüklerken DOĞRU/YANLIŞ damgası); düğmeler ve ←/→ da çalışır. Her cevaptan sonra ekran yeşil/kırmızı yanıp söner, alt satırda doğru cevap. **3 hak** (`QUICK_LIVES`): her yanlışta sıradaki kutuya damga animasyonlu çarpı; 3 yanlış ya da 60 sn biter ("Haklar bitti" / "Süre bitti").
- **Odak sayacı (Pomodoro):** `FOCUS_PLANS` 25+5 (uzun mola 15) ve 50+10 (uzun 20), 4 turda bir uzun mola. Halka gösterge (odakta sarı, molada yeşil), tur noktaları, isteğe bağlı "Neye çalışıyorsun?" dersi, Duraklat/Devam, Molaya geç/Molayı atla, Bitir (geçen odak dakikaları sayılır). Odak bitince mola **kendiliğinden** başlar; mola bitince sıradaki tur "N. turu başlat" diye bekler. Molada Eşleştir/Hızlı tur önerisi (seçilen dersin kartlarıyla). Son 7 gün çubuk grafiği, "Bugün: X dk · N tur".
- **Uygulama genelinde sayaç:** `src/lib/focusStore.ts` (tek paylaşılan durum, `localStorage` `studymode.focus.v1`, sekmeler arası senkron) + `FocusEngine` (Layout'ta): hangi sayfada olursan ol fazı ilerletir, tamamlanan odak turunu kaydeder (dakika, tur, seri), ses çalar, uygulama arka plandaysa sistem bildirimi gönderir (izin "Başla"ya basınca istenir; iOS'ta yalnızca ana ekrana eklenmiş uygulamada çalışır), sekme başlığında geri sayım, diğer sayfalarda sağ altta küçük sayaç rozeti. Uygulama kapalıyken biten faz, bittiği andan itibaren hesaplanır.
- Eski kayıtlar uyumlu: önceki sürümün sayaç kaydı (plan/faz yok) okunur; `rounds` alanı yoksa boş sayılır.

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

**İmza (Made by JustFurkan):** `src/components/MadeBy.tsx` tek kaynak (ad + sosyal hesaplar). Görünür yerler: tanıtım sayfası alt bilgisi, bilgisayarda yan menünün altı, telefonda her sayfanın en altı (`.mobile-made-by`, alt menünün üstünde). İmza **`/hakkinda` sayfasına** gider (`src/pages/About.tsx`, uygulama menüsünün dışında, `/hakkında` yazımı da çalışır): büyük piksel gökyüzü, fotoğraf, "Selam, ben JustFurkan", birinci ağızdan iki paragraf, sosyal hesaplar, "Instagram'dan yaz". Sürprizler: "Burayı nasıl buldun?" (4 seçenek, her birine esprili cevap) ve fotoğrafa 5 kez dokununca "Gizli başarım açıldı: Kurcalamacı" + piksel kıvılcımlar. Ayrıca Ayarlar → "Hakkında" kartvizit kartı (`MakerCard`: üstte hareketli piksel gökyüzü (`PixelSky.tsx`: iki katman piksel bulut farklı hızda kayar, fosforlu yıldızlar göz kırpar; renkler `--sky-top/--sky-bottom/--cloud/--cloud-shade` belirteçlerinde, karanlıkta gece gökyüzü; hareket azaltma tercihinde durur), kullanıcının piksel sanat profil resmi (`public/maker-160.webp`, `maker-320.webp`, eğik, fosforlu çerçeve), birinci ağızdan kısa selam, marka logolu yuvarlak bağlantılar, "Instagram'dan yaz" ana düğmesi). Hesaplar (6 tane; hakkında sayfasında bilgisayarda 3+3, telefonda 2+2+2): Instagram @furkann_ztrk, LinkedIn M. Furkan Öztürk (linkedin.com/in/m-furkan-öztürk-43bb933a8, adres kodlanmış yazılır), X @furkan_ztrk_, TikTok @justfurkann_, YouTube @justfurkann, GitHub justfurkann. Logolar Simple Icons'tan (CC0) `BrandIcon.tsx` içine gömülü yollar; tema rengini alır, paket bağımlılığı yok. WhatsApp kasıtlı olarak eklenmedi (herkese açık sitede numara/hesap paylaşmak; kullanıcıya soruldu).

**Aşama 10 — Görünürlük: Analytics, geri bildirim, hata kaydı, haftalık rapor: ✅ TAMAM** — kullanıcı isteği: "Claude ile bağ kurabileceğimiz, siteye faydası olacak bir şey".
- **Vercel Web Analytics:** kullanıcı Vercel'de açtı; `@vercel/analytics` 2.0.1 (`main.tsx`, `<Analytics />`, localhost'ta kapalı). Çerezsiz. Hobby'de ayda 50.000 olay ücretsiz; aşılırsa yalnızca toplama durur. Claude Vercel üzerinden okur (`count_pageviews`, `aggregate_pageviews`).
- **Geri bildirim:** `src/components/Feedback.tsx` (pencere: Fikir/Hata/Diğer, mesaj, misafirse isteğe bağlı iletişim; 20 sn bekleme) — girişler: Ayarlar'da "Fikrin mi var, hata mı buldun?" bölümü, bilgisayarda yan menünün altı, telefonda her sayfanın sonu ("Fikir · Hata bildir · Made by JustFurkan"), hakkında sayfası. `src/lib/feedback.ts` → `feedback` tablosu (sayfa ve cihaz bilgisiyle; not içeriği gönderilmez).
- **Hata kaydı:** `installErrorReporting` (window error + unhandledrejection) ve `ErrorBoundary` (ekran çökerse "Bir şeyler ters gitti, sayfayı yenile" + rapor) → `client_errors`. Ziyaret başına en fazla 5, aynı mesaj bir kez; ağ kopmaları ve tarayıcı eklentisi gürültüsü atlanır; localhost/testlerde kapalı.
- **Okuma (Claude):** `select * from feedback order by created_at desc` ve `client_errors` için aynısı, Supabase `execute_sql` ile.
- SQL (`schema.sql` sonunda da var):
```sql
-- Feedback and client errors (Aşama 10). Anyone using the app (signed in or not) may add a row;
-- nobody can read, change or delete rows through the API. The owner reads them in Supabase.
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  kind text not null check (kind in ('fikir', 'hata', 'diger')),
  message text not null check (char_length(message) between 3 and 2000),
  contact text check (contact is null or char_length(contact) <= 120),
  page text check (page is null or char_length(page) <= 200),
  device text check (device is null or char_length(device) <= 300),
  created_at timestamptz not null default now()
);
create table if not exists public.client_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  message text not null check (char_length(message) between 1 and 500),
  stack text check (stack is null or char_length(stack) <= 4000),
  page text check (page is null or char_length(page) <= 200),
  device text check (device is null or char_length(device) <= 300),
  release text check (release is null or char_length(release) <= 40),
  created_at timestamptz not null default now()
);
create index if not exists feedback_created_idx on public.feedback (created_at desc);
create index if not exists client_errors_created_idx on public.client_errors (created_at desc);
alter table public.feedback enable row level security;
alter table public.client_errors enable row level security;
drop policy if exists "anyone can send" on public.feedback;
create policy "anyone can send" on public.feedback for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));
drop policy if exists "anyone can report" on public.client_errors;
create policy "anyone can report" on public.client_errors for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));
grant insert on public.feedback, public.client_errors to anon, authenticated;
```

**Yayından sonra eski sekme ("Failed to fetch dynamically imported module"):** Her yayında dosya adları değişir, eskiler silinir; yayından önce açılmış bir sekme, tembel yüklenen parçayı (yapay zekâ kodu, PDF okuyucu, Office okuyucu) eski adla ister ve 404 alır. Kullanıcı ilk kez kendi anahtarını doğrularken bu hatayı gördü (1 Kasım 2026). Çözüm `src/lib/version.ts`: bütün dinamik `import()`'lar `freshImport` içinden geçer; eksik parça Türkçe `StaleVersionError` olur ("Uygulamanın yeni bir sürümü yayınlandı. Sayfayı yenileyip tekrar dene"). Ayrıca sekme yeniden görünür olunca ve 10 dakikada bir `/` sayfasının ana betiği karşılaştırılır; yeni sürüm varsa üstte fosforlu "Uygulamanın yeni sürümü hazır · Yenile" çubuğu (`UpdateWatcher.tsx`) çıkar ve kullanıcı **başka sayfaya geçtiği an** kendiliğinden yenilenir (yazılanlar kaybolmasın diye o sayfadayken zorla yenilemez). Yeni bir dinamik import eklenirse `freshImport(() => import(...))` ile yazılmalı.

**Aşama 11 — Roller, kişi başı günlük yapay zekâ hakkı, yönetim sayfası: ✅ TAMAM** — kullanıcı isteği: VIP/hesaplara özel ayrıcalık, hesapları görmek; arkadaşlara açmadan önce kota.
- **Roller:** `user_roles` (yalnızca `vip` / `admin`; satır yoksa normal). Kullanıcı yalnızca kendi rolünü okuyabilir; rol veren tek yol `admin_set_role` (yönetici kontrolü fonksiyonun içinde) ya da Supabase panelinde SQL. Kurucu hesabı (justfurkan42@gmail.com) yönetici. Yönetici kendi yöneticiliğini kaldıramaz.
- **Günlük hak:** normal 40, VIP 150, yönetici sınırsız; İstanbul gününe göre (`istanbul_today`), sayıları `ai_limit_for` içinde değiştir. `api/generate.ts` Gemini'den önce `ai_quota`yı (kullanıcının kendi token'ıyla) çağırır; dolmuşsa 429 `daily_limit`; **yalnızca başarılı cevaptan sonra** `consume_ai` ile sayar. Fonksiyonlar yoksa ya da Supabase cevap vermezse **açık kalır** (herkesi durdurmaz). Kendi anahtarını bağlayanlar sayılmaz.
- **Uygulama:** `src/lib/account.ts` (`useQuota`), Ayarlar'da ücretsiz yapay zekâ bölümünde rol rozeti + "Bugün 12/40 istek" çubuğu; hak dolunca "Bugünkü ücretsiz yapay zekâ hakkın doldu (40/40). Gece yarısı yenilenir…".
- **Rol rozeti** (`RoleBadge.tsx`, kullanıcı isteğiyle çıkartmadan rozete çevrildi): logonun yanında küçük hap; telefonda yanında, dar yan menüde altında. Renkler `--vip` (mor, taç simgesi) ve `--admin` (turkuaz, kalkan simgesi), üstündeki yazı `--on-role` (beyaz). VIP: "VIP", dokununca "VIP ayrıcalıkların" penceresi (günde 150 istek, bugünkü kullanım, çıkartma, yeni özelliklere erken erişim). Yönetici: koyu "Yönetici", dokununca `/yonetim`. Biri ilk kez VIP görünce o cihazda bir kez "Artık VIP'sin!" karşılaması (`VipWelcome`, Layout'ta tek sefer). Normal hesapta çıkartma yok.
- **Pencereler (`Modal`) artık `createPortal` ile `body`'ye çiziliyor:** bulanık üst çubuk ya da yan menünün içinden açılan pencere o kutuya sıkışıyordu.
- **Yönetim sayfası** `/yonetim` (`src/pages/Admin.tsx`, Ayarlar'da yalnızca yöneticiye "Yönetim paneli" düğmesi): özet (hesap, bugün kullanan, bugünkü istek, VIP), hesap listesi (e-posta, katılım, son giriş, not sayısı, bugünkü istek, son çalışma; rol seçimi), geri bildirimler, son 30 günün telefon hataları. Not içerikleri gösterilmez. Her fonksiyon yöneticiliği kendisi tekrar denetler.
- Yerel Postgres'te sahte auth ile denendi (normal kullanıcı rol ekleyemez, sayacı değiştiremez, yönetim fonksiyonlarını çalıştıramaz; anon hiçbirini çalıştıramaz; VIP 150, normal 40'ta durur; şema iki kez çalışır).
- SQL (`schema.sql` sonunda da var; kurucuyu yönetici yapan satır ayrıca: `insert into public.user_roles (user_id, role) select id, 'admin' from auth.users where lower(email) = 'justfurkan42@gmail.com' on conflict (user_id) do update set role = 'admin';`):
```sql
-- Roles, daily AI quota and the founder's admin tools (Aşama 11).
-- user_roles: only an admin (or SQL in the dashboard) can give a role; users can only read their own.
-- ai_usage: the shared free AI counts requests per user per Istanbul day; users can read theirs,
-- only the server's functions below write it.
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('vip', 'admin')),
  granted_at timestamptz not null default now()
);
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);
alter table public.user_roles enable row level security;
alter table public.ai_usage enable row level security;
drop policy if exists "read own role" on public.user_roles;
create policy "read own role" on public.user_roles for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "read own usage" on public.ai_usage;
create policy "read own usage" on public.ai_usage for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.user_roles, public.ai_usage from anon, authenticated;

create or replace function public.istanbul_today() returns date
language sql stable set search_path = '' as $$ select (now() at time zone 'Europe/Istanbul')::date $$;

-- Daily limits per role; null = no limit. Change the numbers here to adjust.
create or replace function public.ai_limit_for(r text) returns integer
language sql immutable set search_path = '' as $$
  select case r when 'admin' then null when 'vip' then 150 else 40 end
$$;

-- The caller's quota status: role, used today, limit, allowed.
create or replace function public.ai_quota() returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'role', coalesce(r.role, 'normal'),
    'used', coalesce(u.count, 0),
    'limit', public.ai_limit_for(coalesce(r.role, 'normal')),
    'allowed', public.ai_limit_for(coalesce(r.role, 'normal')) is null or coalesce(u.count, 0) < public.ai_limit_for(coalesce(r.role, 'normal'))
  )
  from (select (select auth.uid()) as id) me
  left join public.user_roles r on r.user_id = me.id
  left join public.ai_usage u on u.user_id = me.id and u.day = public.istanbul_today()
  where me.id is not null
$$;

-- Counts one successful AI request for the caller. Only ever adds one.
create or replace function public.consume_ai() returns json
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return null; end if;
  insert into public.ai_usage (user_id, day, count) values (auth.uid(), public.istanbul_today(), 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1;
  return public.ai_quota();
end $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'admin')
$$;

-- Admin: every account with its role and activity (no note contents).
drop function if exists public.admin_users();
create or replace function public.admin_users()
returns table (id uuid, email text, name text, created_at timestamptz, last_sign_in_at timestamptz, role text, ai_today integer, notes bigint, last_study text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
  select u.id, u.email::text, coalesce(u.raw_user_meta_data ->> 'full_name', '')::text, u.created_at, u.last_sign_in_at,
         coalesce(r.role, 'normal')::text,
         coalesce((select a.count from public.ai_usage a where a.user_id = u.id and a.day = public.istanbul_today()), 0)::integer,
         (select count(*) from public.notes n where n.user_id = u.id),
         (select max(s.day)::text from public.study_days s where s.user_id = u.id)
  from auth.users u left join public.user_roles r on r.user_id = u.id
  order by u.created_at desc;
end $$;

-- Admin: give or take a role ('normal' removes it). An admin cannot demote themselves by accident.
create or replace function public.admin_set_role(target uuid, new_role text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if new_role not in ('normal', 'vip', 'admin') then raise exception 'bad role' using errcode = '22023'; end if;
  if target = auth.uid() and new_role <> 'admin' then raise exception 'cannot demote yourself' using errcode = '22023'; end if;
  if new_role = 'normal' then delete from public.user_roles where user_id = target;
  else insert into public.user_roles (user_id, role) values (target, new_role) on conflict (user_id) do update set role = excluded.role, granted_at = now();
  end if;
end $$;

-- Admin: the latest feedback and browser errors.
create or replace function public.admin_feedback()
returns table (kind text, message text, contact text, page text, email text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query select f.kind, f.message, f.contact, f.page, u.email::text, f.created_at
  from public.feedback f left join auth.users u on u.id = f.user_id order by f.created_at desc limit 100;
end $$;

create or replace function public.admin_errors()
returns table (message text, page text, times bigint, last_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query select e.message, e.page, count(*), max(e.created_at)
  from public.client_errors e where e.created_at > now() - interval '30 days'
  group by e.message, e.page order by max(e.created_at) desc limit 50;
end $$;

revoke all on function public.ai_quota(), public.consume_ai(), public.is_admin(), public.admin_users(),
  public.admin_set_role(uuid, text), public.admin_feedback(), public.admin_errors() from public, anon;
grant execute on function public.ai_quota(), public.consume_ai(), public.is_admin(), public.admin_users(),
  public.admin_set_role(uuid, text), public.admin_feedback(), public.admin_errors() to authenticated;
```
- **Test hesabı:** Claude için ayrı bir hesap var (Gmail + adresi); bilgiler oturum ortamında `STUDYMODE_TEST_EMAIL` / `STUDYMODE_TEST_PASSWORD` değişkenlerinde (değerleri asla yazdırma). Canlı sitede gerçek tarayıcıyla giriş 1 Kasım'da doğrulandı. Raporlarda gerçek kullanıcı sayılarından ayrı tut.
- **Ortak not defteri (Claude Docs):** "StudyMode · Fikir defteri" — https://claude.ai/artifact/UkjEttyZqSAekHkWW9bPqw (şimdi sırada, düşünülen fikirler, rafa kalkanlar, kalıcı kurallar). Yeni fikirler oraya yazılır.

**Google ile giriş (canlıda, 1 Kasım 2026'da açıldı):** Giriş/kayıt kartında Google'ın kendi "Google ile devam et" düğmesi (Google Identity Services, `src/lib/googleSignIn.ts`): studymode.fun üzerinde çizilir, Google hesap seçicisi "studymode.fun" der (eski yönlendirme akışı `jpcatyopkpnudgdyncas.supabase.co` yazıyordu ve dolandırıcı gibi duruyordu). Google'ın verdiği kimlik belirteci `supabase.auth.signInWithIdToken({ provider: 'google', token, nonce })` ile doğrulanır; Google'a nonce'un SHA-256'sı, Supabase'e kendisi gider. Client ID `config.ts`'te (`GOOGLE_CLIENT_ID`, herkese açık; secret yalnızca Supabase'de). Google betiği engellenirse eski yönlendirme düğmesine (`signInWithOAuth`) düşer. Google hesap seçicisinde studymode.fun yazdığı kullanıcı tarafından doğrulandı; marka doğrulamasına gerek görülmedi.

**Gizlilik politikası:** `/gizlilik` (`src/pages/Privacy.tsx`, KVKK'ya uygun sade Türkçe: veri sorumlusu, tutulan veriler, amaç, işleyenler (Supabase, Vercel, Google Gemini, Resend, kullanıcının kendi anahtarı), paylaşım bağlantıları, saklama ve silme, kimler görebilir, haklar). Bağlantılar: tanıtım ve hakkında sayfası alt bilgisi, giriş kartı ("Devam ederek gizlilik politikasını okumuş olursun"), telefonda her sayfanın sonu. Veri işleme değişirse (ör. ücretli model) bu sayfa da güncellenmeli. Düğme yalnızca Supabase'de Google sağlayıcısı açıksa görünür (`isGoogleEnabled`, `/auth/v1/settings`), yani kurulum bitmeden hata göstermez. Google'dan gelen ad (`full_name`/`name`/`given_name`) `displayName` ve `firstName` tarafından okunur. Kurulum (kullanıcı yapar): Google Cloud → OAuth izin ekranı + Web istemcisi (yönlendirme adresi `https://jpcatyopkpnudgdyncas.supabase.co/auth/v1/callback`, köken `https://studymode.fun`) → Client ID/Secret Supabase → Authentication → Providers → Google. Faturalandırma gerekmez.

**Google Cloud deneme kredisi (1 Kasım 2026'da açıldı, 300 $ ≈ 14.695 ₺, 31 Ocak 2027'de biter):** Resmî belgeye göre **2 Mart 2026'dan sonra açılan hesaplarda bu kredi Gemini API (AI Studio) için kullanılamaz**; kullanılabilir yol Vertex AI (Gemini Enterprise Agent Platform). Deneme sürerken ve "Upgrade" yapılmadıkça ücret çekilmez; kredi biterse ya da süre dolarsa deneme faturalandırma hesabına bağlı **tüm projeler durdurulur**. Bu yüzden Google girişinin OAuth istemcisi ve ücretsiz Gemini anahtarı deneme faturalandırmasına bağlı bir projede olmamalı (kullanıcıya kontrol ettirilecek). Kullanıcı, Google girişi ve ücretsiz Gemini anahtarının başka bir hesapta olduğunu söyledi (deneme kapanınca etkilenmezler).

**Aşama 12 — Free+ (VIP/yönetici için Vertex AI üzerinde daha güçlü Gemini): canlıda, kurulum tamam (1 Kasım 2026).** Google Cloud tarafı Cloud Shell betiğiyle kuruldu: proje `project-43f6a34a-93f0-4ce2-8c3` (numara 151622099044), havuz ve sağlayıcı `vercel` (yalnızca `owner:justfurkan:project:studymode:environment:production`), hizmet hesabı `studymode-vertex@…` (yalnızca `roles/aiplatform.user`). Vercel'de OIDC (team) açık ve beş `GCP_*` değişkeni production'a girildi. Claude'un test hesabı Free+ denemek için VIP yapıldı.
- Ayarlar → Yapay zekâ'da yalnızca VIP/yöneticiye görünen "Free+" seçeneği (`provider: 'plus'`, `isServerAi`). İstek `/api/generate`'e `engine: 'plus'` ile gider.
- Sunucu (`api/vertex.ts`): **anahtarsız** Vercel OIDC → Google STS → hizmet hesabı taklidi → Vertex `generateContent` (global uç nokta). **Model seçimi göreve göre:** uzun girdiler ve hızlı açıklama (study, transcribe, exam, explain) `gemini-3.8-flash` → `gemini-3.6-flash` (`VERTEX_MODELS`); doğruluğun önemli olduğu işler (grade, memory) `gemini-4-argon` → `gemini-3.1-pro-preview` → `gemini-3.8-flash` (`VERTEX_SMART_MODELS`). Pro/Argon için düşünme düzeyi LOW (zaman sınırı). Ölçüm (1 Kasım): kısa açıklamada Argon ~19 sn, ücretsiz Flash-Lite ~2 sn; bu yüzden explain Flash'ta. Ücretsiz katman: `gemini-3.5-flash-lite` → `gemini-flash-lite-latest` → `gemini-3.1-flash-lite`.. Erişim izni 1 saat önbellekte.
- Tavanlar (`plus_quota` / `consume_plus`): VIP günde 30, yönetici 100, **site geneli günde 300** Free+ isteği; normal günlük haktan ayrı sayılır, yalnızca başarılı cevap sayılır. Tavan dolarsa, Vertex kurulmamışsa ya da Google hata verirse istek **sessizce normal ücretsiz Gemini'ye düşer** (o zaman normal hak sayılır).
- Para güvencesi: kredi Google Cloud deneme hesabından (≈300 $, 31 Ocak 2027'ye kadar). Deneme hesabı "Upgrade" yapılmadıkça ücret çekmez; kredi biterse ya da süre dolarsa yalnızca o (ayrı) proje durur, Free+ ücretsiz Gemini'ye düşer. **Upgrade'e asla basılmayacak.**
- Gerekli Vercel ortam değişkenleri (gizli değil): `GCP_PROJECT_ID`, `GCP_PROJECT_NUMBER`, `GCP_SERVICE_ACCOUNT_EMAIL`, `GCP_WORKLOAD_IDENTITY_POOL_ID`, `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID`; Vercel projesinde OIDC (team issuer: `https://oidc.vercel.com/justfurkan`, aud `https://vercel.com/justfurkan`, sub `owner:justfurkan:project:studymode:environment:production`). `GET /api/generate` yanıtındaki `plus` alanı Vertex'in kurulu olup olmadığını gösterir.
- Gizlilik politikasına Free+ satırı eklendi (Vertex ücretli kullanımda içerik ürün geliştirmede kullanılmaz).
- SQL (`free_plus_caps` migration'ı ile canlıya uygulandı; `schema.sql` sonunda da var):
```sql
-- Free+ (Aşama 12): VIPs and admins may use a stronger Gemini on Vertex AI, paid from Google Cloud
-- trial credit. Hard caps here, on top of Google's own: per person per day by role, and for the
-- whole site per day. When a cap is reached the server quietly uses the normal free AI instead.
alter table public.ai_usage add column if not exists plus_count integer not null default 0 check (plus_count >= 0);
create table if not exists public.ai_plus_daily (
  day date primary key,
  count integer not null default 0 check (count >= 0)
);
alter table public.ai_plus_daily enable row level security;
revoke all on public.ai_plus_daily from anon, authenticated;

-- Change the numbers here to adjust. 0 = not allowed.
create or replace function public.plus_limit_for(r text) returns integer
language sql immutable set search_path = '' as $$
  select case r when 'admin' then 100 when 'vip' then 30 else 0 end
$$;
create or replace function public.plus_site_limit() returns integer
language sql immutable set search_path = '' as $$ select 300 $$;

create or replace function public.plus_quota() returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'role', coalesce(r.role, 'normal'),
    'eligible', public.plus_limit_for(coalesce(r.role, 'normal')) > 0,
    'used', coalesce(u.plus_count, 0),
    'limit', public.plus_limit_for(coalesce(r.role, 'normal')),
    'site_used', coalesce(d.count, 0),
    'site_limit', public.plus_site_limit(),
    'allowed', coalesce(u.plus_count, 0) < public.plus_limit_for(coalesce(r.role, 'normal')) and coalesce(d.count, 0) < public.plus_site_limit()
  )
  from (select (select auth.uid()) as id) me
  left join public.user_roles r on r.user_id = me.id
  left join public.ai_usage u on u.user_id = me.id and u.day = public.istanbul_today()
  left join public.ai_plus_daily d on d.day = public.istanbul_today()
  where me.id is not null
$$;

-- Counts one successful Free+ answer for the caller and for the site. Only for eligible roles.
create or replace function public.consume_plus() returns json
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return null; end if;
  if public.plus_limit_for(coalesce((select role from public.user_roles where user_id = auth.uid()), 'normal')) = 0 then return public.plus_quota(); end if;
  insert into public.ai_usage (user_id, day, count, plus_count) values (auth.uid(), public.istanbul_today(), 0, 1)
  on conflict (user_id, day) do update set plus_count = public.ai_usage.plus_count + 1;
  insert into public.ai_plus_daily (day, count) values (public.istanbul_today(), 1)
  on conflict (day) do update set count = public.ai_plus_daily.count + 1;
  return public.plus_quota();
end $$;

revoke all on function public.plus_quota(), public.consume_plus() from public, anon;
grant execute on function public.plus_quota(), public.consume_plus() to authenticated;
```

### Aşama 13 — Premium sekmesi (/premium)

- **Ne:** VIP/yöneticiye özel parlak sekme. Üç araç: **Sesli not** (iki kişilik podcast, Gemini TTS, Kore/Puck sesleri), **Akıllı arama** (tüm notlarda anlamsal arama, gemini-embedding-001), **Görsel** (gemini-3.1-flash-lite-image). Hepsi Free+ yolundan (Vertex) gider; kendi Gemini anahtarı olan ve Gemini'yi seçen herkes de kullanabilir.
- **Kim görür:** `src/lib/premium.ts` → `usePremium()` (`open` / `locked` / `loading`). Kilitli hesaplar sayfada önizleme + "Nasıl açılır?" görür. Notun içindeki AI görsel / stüdyo sesi / AI senaryo / akıllı arama düğmeleri de kilitli; yerine `PremiumLock` (`src/components/Premium.tsx`) çıkar. Sunucu zaten `premium_only` (403) döner.
- **Giriş noktaları:** kenar çubuğunda parlayan "Premium" bağlantısı; telefonda üst barda elmas düğmesi (yalnızca giriş yapmışken, misafirde yer yok).
- **Canlı test (1 Kasım 2026, test hesabı VIP):** podcast 7 sn / 10 satır; TTS 12 sn, 1,5 MB WAV; görsel 4,5 sn JPEG; embedding 2,4 sn, 3072 boyut.
- **Embedding ayarı:** vektörler 768 sayıya kısaltılıp 5 basamağa yuvarlanır (`compactVector`; not başına ~6 KB, localStorage dolmasın). Ölçüm: ilgili not–soru benzerliği 0,76–0,83, ilgisiz 0,64–0,72 → eşik `VECTOR_MATCH_AT = 0.74`, en iyiye 0,06 yakın olanlar gösterilir (`rankNotesByMeaning`). Embedding Free+ hakkından düşmez; podcast/TTS/görsel düşer.
- **Renk tokenları:** `--prem-1/2/3`, `--prem-deep`, `--prem-soft`, `--prem-text` (yalnızca arka plan/ışıltı; metin değil). `prefers-reduced-motion` ile animasyonlar durur.
- **Not:** Bu aşama sırasında başka bir Claude oturumu (#49–#53: başarımlar, öğrenci tipi testi, tam özet, ortam sesleri) main'e iş birleştirdi; Premium onun üstüne rebase edildi. İki oturumu aynı anda çalıştırmamak gerekiyor.

### Aşama 14-19 — `keen-albattani` oturumu (1 Kasım 2026)

Ayrıntılar ve her özelliğin dosyaları: **`docs/ATMOSFER.md`**. Yeni kod çoğunlukla ayrı dosyalarda; stiller `src/styles/extras.css`, `achievements.css`, `quiz.css` (global.css'e dokunulmadı).

**Aşama 14 (#49) — Çalışma fişi, Gece kütüphanesi, Gece kuşu, Kırtasiye seti**
- Çalışma fişi: Bugün başlığında "Çalışma fişi"; günün/haftanın çalışması kasa fişi olarak 1080×1920 PNG (canvas, `ReceiptCard.tsx`, açılınca yüklenir), paylaş/indir.
- Gece kütüphanesi: yağmur, kafe, şömine, odak (kahverengi gürültü) karıştırıcısı; sesler dosya değil, tarayıcıda üretiliyor (`ambience.ts`). Masaüstünde sol altta, telefonda üst barda kulaklık.
- Gece kuşu: 00.00-04.59 arası not (10 sn'de gizlenir), PixelSky'da kayan yıldızlar.
- Kırtasiye seti (Ayarlar → Görünüm ve ses): 5 kağıt dokusu, 5 fosforlu kalem rengi (`--hi` ve karanlıkta `--accent` değişir), kırtasiye sesleri. `decor.ts`, `<html data-paper data-pen>`.

**Aşama 15 (#50) — Bütün sitenin incelemesi, bulunan hatalar düzeltildi**
- Kavram haritası tanımsız `--ink`/`--muted` kullanıyordu (karanlıkta görünmüyordu); telefonda yana kayan okunur boyut.
- Görseller dokununca tam ekran (`ImageViewer.tsx`); yapay zekâ görselleri 1280 px JPEG'e küçültülüp saklanıyor, alan dolarsa eskiler silinip söyleniyor (`imageStore.ts`); hafıza şeması görselleri saklanıyor, "gizle" artık silmiyor.
- Türkçe harfli indirme adları "download" oluyordu → `safeFileName`.
- Kayıt kuyruğu (`store.tsx`): bağlantı koparsa değişiklikler sekmede bekleyip internet gelince gönderiliyor; kaydedilmemiş iş varken sekme kapanırken uyarı. Yalnızca ağ hataları yeniden denenir.
- Not hazırlanırken sekme kapatma uyarısı; yedek indirme Safari/Firefox'ta inmiyordu; `og:image` (`public/og.png`); "Şifreyi göster"; dokunmatikte klavye ipuçları gizli.

**Aşama 16 (#51) — Tam özet** (arkadaş geri bildirimi: "özetin tamamını tek sayfada göreyim")
- Özet'in en üstünde "Tam özet" kartı + alt sekme (`?adim=tam`, `FullSummary.tsx`): içindekiler, bölüm bölüm anlatım, ezberlenecekler, nottaki örnekler, "Sınavda dikkat", ana noktalar, kavramlar, yazdır.
- "Ayrıntılı özet hazırla": yeni `detail` görevi (`tasks.ts`), uzun not 12.000 karakterlik parçalarla; sonuç `summary.detailed` (jsonb, şema değişikliği yok). Sunucuda `detail` için 45/55 sn, tarayıcı 62 sn bekler. Free+'ta hızlı model; Gemini 4 Argon 60 sn sınırına sığmadığı için kullanılmadı.

**Aşama 17 (#52) — "Hangi öğrenci tipisin?" (`/ogrenci-tipi`)**
- Hesapsız tanıtım testi, uygulama kabuğunun dışında, ayrı yüklenir. Seviye → (üniversite/yüksek lisans ise) okul arama (`universities.ts`, ~208 okul, kısaltmalarla; listede yoksa elle) → 10 soru (seviyenin diliyle: vize/yazılı, hoca/öğretmen) → sonuç.
- Puanlama (`studentType.ts`): 4 eksen (planlı/akışına, anlamaya/sonuca, grupla/yalnız, gece/sabah) + gizli "estetik"; her soru kendi ortalamasına göre merkezli; 8 tipten yön olarak en yakını. Testler: tutarlı cevaplayan kendi tipini alır, rastgele cevaplarda her tip %4-22.
- Kart: özgün animasyonlu karakter (`StudentCharacter.tsx`), açıklama, eksen yüzdeleri, süper güç, kör nokta, taktik, çalışma arkadaşı; 1080×1920 story PNG; bağlantı sonucu taşır, açan "Sen de çöz" görür.

**Aşama 18 (#53) — Başarımlar (`/basarimlar`)**
- 20 başarım, 4 nadirlik (Yaygın, Nadir, Destansı, Efsanevi); 11 gizli keşif "???" + bilmece. Gizliler: Gece Kuşu (03.xx), Erkenci Kuş (04-06), Gün Dönümü (tam 00.00), Dedektif (Gizlilik'in son noktası bir düğme), Glitch Hunter (logoya 2,5 sn'de 7 dokunuş ya da ↑↑↓↓←→←→BA; ekran bozulur), Kurcalamacı (Hakkında fotoğrafı ×5), Kayıp Sayfa (olmayan adres), Işık DJ'i, Kalem Kutusu, Ses Mühendisi, Çok Yüzlü (3 farklı tip).
- `AchievementWatcher` (App kökünde) saat/veri/tema/kalem/ses/klavyeyi izler, nadirliğe göre parlayan bildirim; ilk ziyarette önceden ulaşılmış hedefler sessizce açılır.
- Yan menü: "Başarımlar x/20" ve öğrenci tipi kartı; telefonda Bugün sayfasında. Bugün başlığında kupa.

**Aşama 19 — Öğrenci tipi ve başarımlar profilde, cihazlar arası** (kullanıcı: "testi çözünce kaydedilmiyor, profile işlenmeli")
- Sonuç artık kaybolmuyor: giriş yapmışsa Supabase **`auth` `user_metadata`** içinde (`student_type`), adın tutulduğu yerde; **yeni tablo/SQL yok**. Misafirde tarayıcıda (`studymode.studentType.v1`); giriş yapınca hesaba taşınır. En yeni sonuç geçerli (`studentProfile.ts`).
- Görüldüğü yerler: Ayarlar → "Öğrenci tipin" (karakter, tarih, okul, eksenler, Kartım, Yeniden çöz); yan menü kartı "Öğrenci tipin: …"; test girişinde "Son sonucun". Kendi kartını açan "Arkadaşın…" değil "Sen bir…" görür.
- Başarımlar da `user_metadata.achievements` ile eşitlenir: hesaptakiler cihaza sessizce gelir, cihazdakiler hesaba gider.
- **Bilinçli sınır:** "Bu başarımı oyuncuların %X'i buldu" ya da "ODTÜ'de en çok hangi tip" gibi herkesin verisini sayan istatistikler `user_metadata` ile yapılamaz; bunun için tablo + SQL gerekir (henüz istenmedi, yazılmadı).

### Aşama 20 — Arayüz toparlama (1 Kasım 2026, `dreamy-sagan`)

- **Yan menü kısaldı:** Not ekle, Bugün, Dersler, Tekrar, Sınavlar, Ayarlar, Premium hep görünür; Başarımlar, öğrenci tipi testi ve Hakkında **"Daha fazla" (⋯)** altında katlanır (açık/kapalı `localStorage studymode.navMore`; kendi sayfalarında kendiliğinden açılır). Kısa ekranda menü kayar; öğeler artık ezilmez (`.sidebar > * { flex-shrink: 0 }`). Önceki hata: Premium bağlantısı `overflow: hidden` yüzünden kısa ekranda ince bir şeride dönüşüyordu.
- **Not adımları kısaldı:** Kavramlar, Ana noktalar + **"Araçlar"** menüsü (Hafıza kodlaması, Karşılaştırma, Görsel & Şema, Podcast). Tam özet zaten üstteki büyük kartta; sekmesi yalnızca açıkken görünür. Seçili araç menü düğmesinin adında görünür.
- **Başarımlar halkası:** sayı ortada (önce üst kenara yapışıyordu), kupa + "/20 açıldı"; özet kartında **"Sıradaki hedef"** (açılmamış görünür hedeflerden en yakını, ilerleme çubuğuyla).
- **Öğrenci tipi testi Onedio tarzında:** 10 soru gündelik hayattan (hafta sonu, alarm, dizi, ana ekran, kafe, arkadaş grubu, sınav sabahı, oyun, yeni yıl, "sonraki bölüm"). Her şıkkın eksen ağırlıkları eskisiyle **birebir aynı** (denge testleri değişmeden geçiyor). Şıklar simgeli 2×2 kartlar; seçince bir satırlık tepki (`react`). Sonuç "Bu tam sen" (tip başına 3 cümle, `you`) ile açılır; eksen çubukları ve tüm tiplere uyum "Neden bu sonuç?" altında.
- **Canlı kontroller (keen-albattani'nin istedikleri):** #49-#55 yayınları READY; son 24 saatte yalnızca 2 Free+ zaman aşımı (ücretsize düştü, sorun yok). og.png ve /ogrenci-tipi açılıyor. Test sonucu `user_metadata.student_type` ve `achievements` olarak yazılıyor, ad-soyad korunuyor (veritabanında doğrulandı). Ayrıntılı özet kısa notta ücretsiz 2,9 sn / Free+ 3,9 sn (DETAIL_CHUNK_CHARS değişmedi). AI görsel 4,8 sn, dokununca büyüyor, yenileyince duruyor.

### Aşama 21 — Yönetici başarım kontrolü, görsel filigranı, Premium hissi, tanıtım turu ve Rehber (1 Kasım 2026, `keen-albattani`)

- **Yönetici: başarımı ver / geri al.** `/basarimlar` sayfasında yalnızca `useQuota(...).role === 'admin'` iken "Yönetici modu" anahtarı. Açıkken her kartta "Ver" / "Geri al", gizlilerin gerçek adı görünür. Yalnızca yöneticinin kendi hesabını etkiler.
  - `revoke(id)` (`achievements.ts`): başarımı koleksiyondan ve bildirim sırasından çıkarır, **tutulan** (`held`) listesine koyar. Diğer başarımlar 10'un altına düşerse Koleksiyoncu da gider.
  - Tutulanı kurallar (saat, veri) yeniden açamaz; yalnızca `unlock(id, now, { admin: true })` açar.
  - Eşitleme: hesapta `user_metadata.achievements` yanında `achievements_held: { ids, at }` var. Daha yeni olan liste geçerli. Hesap, geri alınmış bir başarımı hâlâ listeliyorsa `achievements` **üzerine yazılır** (birleştirilmez). Başka cihaz da geri alınanı siler, geri yükleyemez.
- **Filigran.** `imageStore.ts` → `finishAiImage` (= `compressImage(..., watermark: true)`): sağ alt köşede yarı saydam koyu hap içinde logo ve beyaz "studymode.fun", boyutu görsele göre ölçekli. Kapsam: VisualTab (Premium Görsel aynı bileşeni kullanıyor) ve MemoryTabs. Fosforlu poster SVG; etiket SVG'nin içine aynı görünümde çiziliyor.
  - Düzeltme: poster SVG olduğu hâlde ".png" adıyla iniyordu → `imageExtension()`.
- **Premium hissi.** Podcast'te VIP için ana düğme "Stüdyo sesiyle dinle" (`.prem-btn`, `Gem`). Senaryo yapay zekâyla yazılmamışsa önce `generatePodcastScript`, sonra `synthesizePodcastTts`, ilerleme "Senaryo yazılıyor… / Sesler kaydediliyor (1/3)…", bitince çalar. "Hızlı önizleme (cihaz sesi)" ikincil; başlıkta küçük "Gemini 3.8" rozeti. Premium temalı düğmeler: "Diyaloğu AI ile yenile", "AI Görsel Üret", "Akıllı aramayı aç" (CourseDetail). Premium olmayanda değişiklik yok ("Hemen Dinle" + `PremiumLock`).
- **Tanıtım turu** (`components/Tour.tsx`, `lib/tour.ts`):
  - 5-6 adım: Not ekle, Bugün, Tekrar, Sınavlar, Premium (yalnızca açıksa), Daha fazla (telefonda "Hesap ve ayarlar"). Işık halkası ve balon; Geri / İleri / Atla, ← → Esc.
  - Hedefler `data-tour="…"` (yan menü, telefonda alt ve üst bar). Bir kez görülünce `studymode.tour.v1`.
  - Ayarlar ve Rehber'de "Turu tekrar başlat" (`requestTour()`).
  - Açık bir pencere ya da bildirim varken başlamaz. Tur açıkken başarım bildirimi ve VIP karşılaması bekler.
  - `prefers-reduced-motion`'da animasyon yok.
  - **Otomatik testlerde (`navigator.webdriver`) kendiliğinden başlamaz**; test açmak isterse `studymode.tour.force` koyar.
- **Rehber** (`/rehber`, `pages/Guide.tsx`):
  - "Nasıl ilerlemeli?" (5 adım) ve 16 özellik kartı.
  - VIP bölümü `#premium`: sesli not ne zaman, akıllı arama nasıl sorulur, görseli karta çevirmek, günlük 30 hak ve aramanın haktan düşmediği.
  - Bağlantılar: "Daha fazla" menüsü, Ayarlar, Premium sayfası ("Premium'u en iyi nasıl kullanırsın?").
- Testler: 239 birim, 93 tarayıcı. Yeniler: yönetici ver/geri al ve yeni cihaz, normal kullanıcı görmez, filigran piksel kontrolü, tur, bildirimin turu beklemesi, Rehber. Premium testi yeni tek düğme akışına güncellendi (`podcast` → `tts` sırası).
- **SQL yok, Vercel/Supabase ayarı yok.**

## Tasarım dili ("Fosforlu")

Fikir: "Notunu yükle, önemlisini biz işaretleyelim." Kareli defter zemini, lacivert mürekkep, tek parlak renk olarak fosforlu sarı.
- **Renkler** `src/styles/global.css` başındaki değişkenlerde; bileşenlerde sabit renk yazma. Aydınlık: zemin `#fafaf6`, mürekkep `#1b2250`, fosforlu `#ffe14d`. Karanlık: gece laciverti `#11142a`, metin `#f4f3ea`, fosforlu aynı.
- **Sarı yalnızca zemindir**, asla yazı rengi değil (beyaz üstünde okunmaz). Sarının üstündeki yazı her zaman `--on-hi` (lacivert).
- **Vurgu kelimesi:** `<span className="hl">kelime</span>` fosforlu kalem gibi işaretler. Başlıkta en fazla bir kelime.
- **Basılabilir görünüm** (lacivert çerçeve + alt gölge) yalnızca ana eylemde (`btn-primary`) ve odak kartlarında (çalışma kartı, test kartı, giriş kartı, ilk açılış). Listeler ve diğer paneller sade kalır.
- **Yazı tipleri:** başlıklar `--font-display` (Bricolage Grotesque, 700-800, sıkı harf aralığı), gövde `--font-body` (Figtree).
- **Emoji kullanma**; gerekiyorsa lucide simgesi.

## 8. Kullanıcının elle denemesi gerekenler (henüz teyit edilmedi)

**Aşama 14-19 için (Claude bu ortamdan canlı siteye ve Supabase/Vercel'e erişemedi):**
- Yayın: https://studymode.fun/og.png ve https://studymode.fun/ogrenci-tipi açılıyor mu (yeni sürüm canlıda mı).
- WhatsApp'ta studymode.fun linki atınca önizleme görseli çıkıyor mu.
- Sesler kulağa iyi geliyor mu: Ayarlar'da "Kırtasiye sesleri", kulaklık düğmesinde yağmur/kafe/şömine/odak.
- Gerçek yapay zekâ görseli: büyütme, indirme, sayfa yenilenince durma (küçültme gerçek görselle denenmedi).
- "Ayrıntılı özet hazırla" gerçek bir notta kaç saniye ve yeterince ayrıntılı mı.
- Öğrenci testi telefonda: "Hikâyende paylaş" Instagram'ı açıyor mu (özellikle iPhone), story düzgün mü.
- Giriş yapmış hesapta testi çöz → başka cihazda Ayarlar'da "Öğrenci tipin" görünüyor mu (user_metadata yazımı canlıda denenmedi).
- Logoya 7 hızlı dokunuşta ekran bozuluyor mu; Gizlilik'in son noktası telefonda dokunulabiliyor mu.
- Üniversite listesi: arkadaşların okulları çıkıyor mu.

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
