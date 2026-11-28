# StudyMode — Güncel durum (yeni oturum önce bunu okur)

Son güncelleme: 28 Kasım 2026. Geçmiş ve ayrıntı: `docs/HANDOFF.md` (arşiv; yalnızca gerekince, başlıklarına `grep -n "^#"` ile bak). Bu dosya en fazla 150 satır kalır; bir iş bitince ilgili satırı güncelle.

## 1. Kırmızı çizgiler (değişmez)

**Fosforlu tasarım dili** (`src/styles/global.css` değişkenleri)
- Renk bileşende sabit yazılmaz; değişken kullanılır. Zemin `#fafaf6`, mürekkep `#1b2250`, fosforlu `#ffe14d`; karanlıkta `#11142a` / `#f4f3ea`.
- Sarı yalnızca zemindir, asla yazı rengi değil. Sarı üstündeki yazı `--on-hi` (lacivert).
- Vurgu: `<span className="hl">`; başlıkta en fazla bir kelime.
- Basılabilir görünüm (lacivert çerçeve + alt gölge) yalnızca ana eylemde (`btn-primary`) ve odak kartlarında; listeler ve paneller sade.
- Yazı tipleri: başlık `--font-display` (Bricolage Grotesque 700-800), gövde `--font-body` (Figtree). Emoji yok; gerekirse lucide simgesi.

**Mağaza kuralları (App Store, Google Play)**
- Uygulamada dış ödeme, Shopier ya da Premium koduna yönlendirme yok. iPhone'da satın alma yalnızca StoreKit.
- Satın alma ekranı ve mağaza metni yalnızca uygulamada çalışanı vaat eder; özellik çalıştıkça metne eklenir.
- Uygulamadan açılan site sayfaları `?app=ios` / `?app=android` ile açılır (`src/lib/appMode.ts`): Premium bağlantıları, satın alma düğmeleri, kod girişi ve Shopier gizlenir.
- Hesap silme uygulamada var; adres `https://studymode.fun/hesap-sil` (Google Play şartı).

**Veri**
- `study_days` yalnızca `bump_study_day` RPC ile yazılır (insert/upsert/update yok).
- `summary` ve `practice` alanları ham JSON olarak yazılır; bilinmeyen alanlar silinmez.
- Ajanlar SQL çalıştırmaz: SQL `supabase/schema.sql`'e yazılır, kullanıcıya nerede çalıştıracağı söylenir.

**Ürün ve yapay zekâ**
- Site ile uygulama eşit olur. Eksik, bir şey silinerek ya da gizlenerek çözülmez; siteyi uygulamaya taşı (Premium dışı özellikler dahil).
- Yapay zekâ talimatı (`src/lib/ai/tasks.ts`) değişirse canlıda gerçek notla denenir. Sözel talimatı korumak için hash testi var (`src/lib/questionQuality.test.ts`); sözel talimata dokunulmaz.
- Google AI Studio projesine faturalandırma bağlanmaz.

**Altyapı sınırı**
- Vercel Hobby planı en fazla 12 sunucu fonksiyonuna izin verir. `api/` altındaki her `.ts` dosyası sayılır (yardımcılar dahil: `appleStore.ts`, `vertex.ts`); test dosyaları `.vercelignore` ile dışarıda tutulur. Şu an 8; yeni uç eklemeden önce say.

**Git ve iş düzeni**
- `main`'e birleştirme yok; dal + PR, PR'ı kullanıcı birleştirir. Auto-merge açılmaz.
- Commit ve PR metninde model adı ve Co-Authored-By yok.
- `package-lock.json` commit'lenmez (bilerek bağımlılık eklenmediyse). Sabit sürüm/numara kendiliğinden artmaz.
- Gizli anahtar istenmez, sohbete yapıştırılması önerilmez; "kullanıcının panel işi" diye yazılır.
- Dört kontrol: `npm test`, `npm run build`, `npx tsc -p tsconfig.api.json`, `npm run test:e2e`. Çıktıdan yalnızca hatalar ve son 20 satır okunur.
- CLAUDE.md: Rive, Lottie ve ShipSwift işleri kullanıcının Codex tarafında yaptırdığı iş bölümüdür. Saf kodla çözmek yerine bir araç belirgin şekilde daha iyiyse kullanıcıya mutlaka söyle: "Bunu kodla yaparım ama istersen … ekleyip onunla yapalım."

## 2. Ekip ve roller

- Roller: Site, iPhone, Android, Kalite kontrol. Yönetici oturum alt ajanları `docs/ROLES.md` tarifleriyle başlatır; herkes kendi worktree ve dalında çalışır, başkasının klasörüne dokunmaz.
- Site: `src/`, `api/`, `tests/`, `supabase/`, `public/`, `docs/`; dal `claude/site-<konu>` (`origin/main`'den). iPhone: yalnızca `ios/`, dal `ios-taslak`. Android: yalnızca `android/`, dal `android-taslak`. Kalite kontrol: yalnızca rapor.
- Defterler: Site `docs/HANDOFF.md` (yeni aşama) + bu dosya; iPhone `ios/PLAN.md`; Android `android/PLAN.md`.
- Haberleşme: `docs/IOS_SYNC.md` (site ↔ iPhone), `docs/ANDROID_SYNC.md` (site ↔ Android). Kullanıcı aradaki postacıdır.
- Aynı dosyaya iki oturum aynı anda dokunmaz. Takılınca beklenmez: soru rapora yazılır, iş sürer.

## 3. Altyapı

- **Vercel:** `main` her birleştirmede yayına çıkar (studymode.fun). Hobby plan, 12 fonksiyon sınırı. Proje `prj_MKBVUckUIIar9RINW2u77MmYraGb`.
- **Supabase:** proje `jpcatyopkpnudgdyncas`; giriş (e-posta, Google, Apple) + Postgres + RLS. Şema `supabase/schema.sql`. E-posta Resend (`noreply@studymode.fun`).
- **Yapay zekâ:** `/api/generate` (giriş zorunlu): ortak Gemini, Vertex yolu (`api/vertex.ts`, gömme vektörleri dahil); kullanıcı isterse kendi anahtarı (yalnızca tarayıcıda). Anahtarlar Vercel ortam değişkenlerinde; buraya yazılmaz.
- **Shopier:** yalnızca sitedeki Premium kodu satışı; uygulamada yok.
- **App Store:** StoreKit 2 ürünleri `premium.twoweeks`, `premium.monthly`, `premium.sixmonths`; sunucu `api/apple-purchase.ts`, `apple-status.ts`, `apple-notifications.ts`.
- **Sabit kimlikler:** Apple Team ID `Q2VWX7322K`; bundle / paket `fun.studymode.app`; Google Cloud proje numarası `189951485932`.

## 4. Güncel durum

**Site** (Aşama 76'ya kadar, hepsi main'de)
- Aşama 70: telefon ve site birbirinin verisini ezmiyor (`bump_study_day`, sekmeye dönünce sessiz yenileme). 69: yeni Tekrar (günde tek oturum).
- Aşama 71-72: iPhone'da Premium için App Store sunucusu; paylaşılan ders linkleri uygulamayı açar (`applinks`).
- Aşama 73-74: CLAUDE.md, ROLES.md, ANDROID_SYNC.md; uygulama modu (`?app=ios`), App Store koşulları, `/hesap-sil`.
- Aşama 75: uygulama modunda yasal metinler (Shopier maddeleri çıkar), gömme `kind: query|document`, soru kalitesi 1. adım (`studyNumeric`, yalnızca yöneticiler; `QUESTION_QUALITY_FOR` `config.ts`).
- Aşama 76: ana sayfada nottan çalışma setine animasyon (SVG/CSS; Rive taslağı ayrı prototip).

**iPhone** (`ios-taslak`, `ios/PLAN.md`): adımlar 1-6 ve ek özelliklerin çoğu kodlandı: giriş, dersler, özet, kartlar, Tekrar, Test, not ekleme (PDF, fotoğraf), Bugün, Fosfor, Ayarlar, Başarımlar, Mola, Çalışma fişi, Premium (StoreKit), akıllı arama, Apple/Google girişi, hesap silme. Ücretli Apple ekibi açıldı (26 Kasım). Adım 7 (toparlama, birim testleri) sırada. Gerçek cihaz denemeleri ve mağaza gönderimi bekliyor.

**Android:** yalnızca plan (`android/PLAN.md`, `android-taslak` dalı; main'de `android/` yok). Kod yok, beklemede.

## 5. Açık işler ve bekleyen kararlar

**Soru kalitesi (Aşama 67 planı, 75 ile 1. adım yapıldı)**
- Canlı deneme (kullanıcı): yönetici hesabıyla matematik PDF'inden not → sorular; normal hesapla karşılaştır. Hesap sorularının doğruluğu elle bakılır.
- Sıradaki adımlar: hesap/uygulama soruları + adım adım çözüm açıklaması, sonra cevap kontrolü (soru cevabı görmeden ikinci kez çözülür, tutmazsa atılır). Sonra karar: `QUESTION_QUALITY_FOR = 'everyone'`.
- İleride: derse "gerçek sınavdan örnek soru" ekleme.
- Akıllı arama eşiği `VECTOR_MATCH_AT = 0.74` `RETRIEVAL_QUERY` ile yeniden ölçülmeli (canlıda ilgili/ilgisiz sorgular).

**Bilinen sorunlar**
- Uzun notlarda genel özet (`summary.overview`) parça parça yapıştırıldığı için dev "Bu ders notu…" paragrafı oluyor; önce bu düzeltilmeli.
- `repairLatexEscapes` (`tasks.ts`) bütün yapay zekâ cevaplarına uygulanıyor; yalnızca formül beklenen görevlere / formül içeren cevaplara daraltılmalı.
- Trigonometri formüllü bir sayfa iki denemede de okunamadı.
- İki cihazda aynı anda aynı kart/not düzenlenirse son yazan kazanır.

**Kullanıcının elle denemesi gerekenler (teyit edilmedi)**
- Secret anahtarın (`sb_secret_…`) iptal edildiği teyit edilmedi (Supabase → API Keys).
- Gerçek Gemini ile sınav provası kalitesi; fotoğraf ve taranmış PDF okuma; yapay zekâ çıktı kalitesi gerçek notla.
- "Şifremi unuttum" akışı gerçek e-postayla; seri ve günlük hedefin iki cihazda doğru sayılması.
- Öğrenci testinde "Hikâyende paylaş" (iPhone); kullanıcı meta verisi yazımı canlıda; WhatsApp önizleme görseli.
- Sesler (kırtasiye, ortam sesleri) kulağa iyi geliyor mu; gerçek yapay zekâ görseli.

**Kullanıcıya bağlı**
- Google marka doğrulaması (Search Console TXT kaydı); Google Play Console'da hesap silme adresi; destek e-postası (şimdilik `SELLER.email`).
- Koşullar ve Gizlilik'teki Shopier paragrafları için karar.
- iPhone: site sayfalarını `?app=ios` ile açma ve gömmede `kind: "query"` (ayrıntı `docs/IOS_SYNC.md`).
