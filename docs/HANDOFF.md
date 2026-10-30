# StudyMode — Devir Notu (Claude Code oturumu, 30 Ekim 2026)

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

## 3. Teknoloji ve kod yapısı

React 19 + TypeScript + Vite 7, React Router 7, Supabase JS, Anthropic SDK, zod 4, pdf.js, fflate (Office dosyaları), lucide-react ikonları, yazı tipleri Bricolage Grotesque (başlık) ve Figtree (gövde) — `@fontsource-variable`. Sürümler `package.json`'da sabit (`^` yok). Google AI Studio `package-lock.json`'ı sürekli siliyor; sürümler sabit olduğu için sorun değil, lockfile commit'lenmiyor.

```
api/generate.ts          Vercel fonksiyonu: oturum doğrulama, sabit görevler (study, exam, grade, transcribe, explain), Gemini çağrısı
src/lib/ai/              tasks.ts (talimatlar + zod şemaları, sunucuyla ortak), index.ts (sağlayıcılar, uzun not bölümleme), gemini.ts
src/lib/store.tsx        Tüm veri işlemleri (yerel/Supabase), seri sayımı
src/lib/backend.ts       Yerel depolama + Supabase; OPTIONAL_TABLES ve OPTIONAL_COLUMNS (tablo/sütun yokken çökmez)
src/lib/                 srs.ts (aralıklı tekrar), streak.ts, learningPath.ts (5 adım, hâkimiyet), studyPlan.ts, exam.ts,
                         examSession.ts, practice.ts, importNote.ts, officeText.ts, auth.ts, settings.ts, courseExams.ts (YARIM)
src/pages/               Landing (tanıtım), Today, Courses, CourseDetail, NoteDetail, AddNote, Review, Exam, ExamHistory, Settings, Login, ResetPassword
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
Son yeşil durum (Aşama 4 sonrası): 113 birim testi, 36 tarayıcı testi.

## 4. Veritabanı

Tablolar: `courses`, `notes`, `cards`, `quiz_attempts`, `exam_results`, `study_days` (hepsi `user_id` + RLS "own rows").

**Çalıştırıldı (kullanıcı teyit etti, Ekim 2026):** ilk şema, `exam_results`, `study_days`, `quiz_attempts.answers`, `study_days.actions`, `course_exams`. Bekleyen SQL yok.

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

#2 baştan yazım · #3 Supabase bağlantısı · #4 e-posta doğrulama mesajı · #5 toplu dosya yükleme · #6 ortak ücretsiz yapay zekâ + kendi anahtarı · #7 sınav provası · #8–#9 dosya ekleme, teşhis uç noktası · #10 Gemini yeniden deneme/yedek model · #11 lockfile, README · #12 Türkçe dosya adı indirme hatası · #13 README adresi · #14 ad-soyad, şifre tekrarı, şifremi unuttum · #15 öğrenme yolu testleri · #16 sınav geçmişi, hazırlık durumu, Word/PowerPoint, yeni kullanıcı akışı · #17 taranmış PDF istek boyutu, aynı günde seri toplamı · **#18 Aşama 1 (aşağıda)**

## 7. Şu anki hedef (kullanıcının "goal"u) ve durum

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
- Kartlar: tek kart akışı — soru → **İpucu** (cevaptan türetilir: kısa cevapta "M_________", uzun cevapta ilk kelimeler; `src/lib/cardHint.ts`) → **Çevir** → **Tekrar / Bildim** → sonraki. "Tekrar" denen kart turun sonuna döner. Tur sonunda 🎉 "6 kartın 5 tanesini ilk denemede bildin". Kart listesi, Kart ekle ve "Tekrar ekranında çalış" kapalı **"Kartları yönet (N)"** çekmecesinde. Klavye: boşluk çevirir, 1 Tekrar, 2 Bildim.
- Anlat: tek satır yönerge, "Bitir: Konuyu öğrendim", bitişte "Bu notu bitirdin! 🎉".
- Ölü CSS temizlendi (roadmap, metrik kartı, eski kart eğitmeni; ~336 satır).

**Teslimde istenenler:** (1) 7 AI Studio maddesi + 6 hata için durum raporu ve elle denenecekler, (2) SQL ve Vercel adımları, (3) AI Studio'ya devir mesajı, (4) "arkadaşlarla teste hazır mı" değerlendirmesi.

**Aşama 4 — Görsel tasarım yenilemesi: ✅ TAMAM (Aşama 4 PR'ı)**
- Kullanıcıya üç yön sunuldu (A Fosforlu, B Kütüphane, C Pati); **A seçildi**.
- Giriş yapmamış ve hiç dersi olmayan ziyaretçi `/` adresinde artık uygulama yerine **tanıtım sayfasını** görür (`src/pages/Landing.tsx`); sayfa her zaman `/tanitim` adresinden de açılır. E-posta bağlantısı hatası varsa tanıtım yerine uygulama kabuğu açılır (hata mesajı görünsün diye).
- Giriş yapmış ama dersi olmayan kullanıcı için kısa ilk açılış ekranı (`Welcome.tsx`).
- Logo `src/components/Brand.tsx`; favicon ve `icon-192/512.png` yenilendi.
- Telefonda üstte "Misafir · Bu cihazda kayıtlı" şeridi yerine logo + "Giriş yap" / baş harf çubuğu.
- Emojiler kaldırıldı (🔥 → alev simgesi + son 7 gün şeridi, 🎉 → fosforlu onay rozeti).

## Tasarım dili ("Fosforlu")

Fikir: "Notunu yükle, önemlisini biz işaretleyelim." Kareli defter zemini, lacivert mürekkep, tek parlak renk olarak fosforlu sarı.
- **Renkler** `src/styles/global.css` başındaki değişkenlerde; bileşenlerde sabit renk yazma. Aydınlık: zemin `#fafaf6`, mürekkep `#1b2250`, fosforlu `#ffe14d`. Karanlık: gece laciverti `#11142a`, metin `#f4f3ea`, fosforlu aynı.
- **Sarı yalnızca zemindir**, asla yazı rengi değil (beyaz üstünde okunmaz). Sarının üstündeki yazı her zaman `--on-hi` (lacivert).
- **Vurgu kelimesi:** `<span className="hl">kelime</span>` fosforlu kalem gibi işaretler. Başlıkta en fazla bir kelime.
- **Basılabilir görünüm** (lacivert çerçeve + alt gölge) yalnızca ana eylemde (`btn-primary`) ve odak kartlarında (çalışma kartı, test kartı, giriş kartı, ilk açılış). Listeler ve diğer paneller sade kalır.
- **Yazı tipleri:** başlıklar `--font-display` (Bricolage Grotesque, 700-800, sıkı harf aralığı), gövde `--font-body` (Figtree).
- **Emoji kullanma**; gerekiyorsa lucide simgesi.

## 8. Kullanıcının elle denemesi gerekenler (henüz teyit edilmedi)

- Fotoğraf ve taranmış PDF'ten not okuma, gerçek Gemini ile (hiç denenmedi).
- Yapay zekâ çıktı kalitesi, gerçek bir ders notuyla (sorular, Türkçe, uydurma bilgi var mı).
- Seri ve günlük hedefin iki cihazda doğru sayılması.
- "Şifremi unuttum" akışının gerçek e-postayla uçtan uca çalışması.
- Secret anahtarın iptal edildiğinin teyidi.

## 9. Kullanıcıyla çalışma tarzı

- Türkçe, uzun ve analizli cevaplar ister; "üçüncü göz" gibi dürüst değerlendirme bekler, her zaman haklıymış gibi davranılmasını istemez.
- Teknik değil; adımlar tıklama tıklama, ekran görüntüsü istenerek anlatılmalı. Gizli anahtarları sohbete yapıştırabilir; anahtar türleri net ayrılmalı.
- Asıl önerilen yol: yeni özellik yığmadan önce 2-3 arkadaşla bir hafta gerçek kullanım ve geri bildirim.
