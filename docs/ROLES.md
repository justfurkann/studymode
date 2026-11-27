# StudyMode — Roller (alt ajanların sabit tarifi)

Yönetici oturum her turda alt ajanları bu dosyadaki tariflerle başlatır. Ekip düzeninin tamamı: `docs/HANDOFF.md` → "0. Ekip düzeni".

## Herkes için ortak kurallar

- **Hiçbir şey `main`'e birleştirilmez.** PR açılır, kullanıcı birleştirir.
- Herkes kendi git worktree'sinde ve kendi dalında çalışır; başka rolün klasörüne dokunmaz.
- Gizli anahtar istenmez, sohbete yapıştırılması önerilmez. Anahtar gereken iş "kullanıcının panel işi" diye yazılır.
- Commit ve PR metinlerine yapay zekâ **model adı yazılmaz** (Co-Authored-By satırı dahil).
- `package-lock.json` değişikliği commit'lenmez (bilerek bağımlılık eklenmediyse). Sabit sürüm/numara (ör. `CURRENT_PROJECT_VERSION`) kendiliğinden artırılmaz.
- Takılınca ya da kullanıcı kararı gerekince beklenmez: soru rapora yazılır, iş kalan kısımla sürer.
- İş bitince kendi defterine (aşağıda) dört başlık yazılır: **Yapılan · Kararlar · İşe yaramayan · Sıradaki**.
- Yapay zekâ talimatları (`src/lib/ai/tasks.ts`) testlerle korunmaz; değişirse canlıda gerçek notla denenmeli.
- Hedef site ile uygulamaların eşit olması: siteyi uygulamaya taşı, eksikliği bir şeyi silerek ya da gizleyerek çözme (Premium dışı özellikler de dahil). Mağaza metni yalnızca uygulamada çalışanı vaat eder; özellik çalıştıkça metne eklenir.

## A. Site

- **Okur:** `docs/HANDOFF.md` (0. bölüm + son 3 aşama), `docs/IOS_SYNC.md`, `docs/ANDROID_SYNC.md`, kökteki `CLAUDE.md`.
- **Dokunur:** `src/`, `api/`, `tests/`, `supabase/`, `public/`, `docs/`, kök ayar dosyaları. **Dokunmaz:** `ios/`, `android/`.
- **Dal:** `claude/site-<konu>`, `origin/main`'den.
- **Kurallar:** Her değişiklikte 4 kontrol: `npm test`, `npm run build`, `npx tsc -p tsconfig.api.json`, `npm run test:e2e` (ilk sefer `npm install`, `npx playwright install chromium`). Veritabanı değişikliği (SQL) kendisi çalıştırmaz; `supabase/schema.sql`'e yazar ve kullanıcıya hangi SQL'i nerede çalıştıracağını söyler. `study_days` yalnızca `bump_study_day` RPC ile artırılır.
- **Defter:** `docs/HANDOFF.md` (yeni "Aşama N"), gerekirse `IOS_SYNC.md` / `ANDROID_SYNC.md`'de satırını ✅'ler.

## B. iPhone

- **Okur:** `ios/PLAN.md` (özellikle "Devir notu" bölümleri), `docs/IOS_SYNC.md`, gerektiğinde sitenin kodu (yalnızca okumak için: `src/lib/types.ts`, `srs.ts`, `dailyReview.ts`, `mathPages.ts` …).
- **Dokunur:** yalnızca `ios/`. Siteden bir şey gerekiyorsa `docs/IOS_SYNC.md`'ye "Uygulamanın siteden beklediği işler" altına yazar (bu dosya tek ortak dosya).
- **Dal:** `ios-taslak` (worktree'de `ios-taslak`'tan açılan bir yan dal; yönetici sonra `ios-taslak`'ı ileri sarar ve iter).
- **Kurallar:** Değişiklikten sonra `xcodebuild` ile simülatör derlemesi temiz geçmeli. Apple mağaza kuralları: uygulamada olmayan özellik satılmaz/vaat edilmez; uygulama içinde Shopier'e ya da Premium koduna yönlendirme yok; satın alma yalnızca StoreKit. Uygulamadan bir site sayfası açarken adrese `?app=ios` ekle (site o sekmede Premium/Fiyatlar bağlantılarını, satın alma düğmelerini ve Shopier'i gizler; `src/lib/appMode.ts`). Sitenin verisini bozacak yazma yok (sitenin şemasına ve kurallarına birebir uy).
- **Defter:** `ios/PLAN.md` (adım tablosu + "Devir notu").

## C. Android

- **Okur:** `ios/PLAN.md` (kapsam örneği), `docs/IOS_SYNC.md`, `docs/HANDOFF.md`, sitenin veri kuralları: `src/lib/types.ts`, `src/lib/srs.ts`, `src/lib/dailyReview.ts`, `supabase/schema.sql`.
- **Dokunur:** yalnızca `android/`. Siteden bir şey gerekiyorsa `docs/ANDROID_SYNC.md`'ye yazılmasını yöneticiye bildirir (o dosya site tarafında).
- **Dal:** `android-taslak`, `origin/main`'den.
- **Kurallar:** Kotlin + Jetpack Compose, MVVM, katmanlar `data/domain/ui` (abartı yok). Supabase için `supabase-kt`. `study_days` yalnızca `bump_study_day` RPC. Yeni backend yok: aynı Supabase + `/api/generate`. Paket adı `fun.studymode.app`. Uygulamadan bir site sayfası açarken adrese `?app=android` ekle (site o sekmede satış bağlantılarını gizler; `src/lib/appMode.ts`).
- **Defter:** `android/PLAN.md`.

## D. Kalite kontrol

- **Okur:** A, B, C'nin dallarındaki farklar (`git diff origin/main...<dal>`, `git diff <eski>..ios-taslak`), PR'lar, test çıktıları.
- **Dokunur:** **hiçbir şey.** Commit, push, PR yorumu yok; yalnızca rapor.
- **Baktığı yerler:** sitenin verisini bozabilecek yazmalar (tablo/sütun uyumu, `study_days` RPC kuralı, silme), rol sınırı ihlalleri (`ios/` dışına taşma, `android/` dışına taşma, `package-lock.json`, sabit sürüm), Apple ve Google mağaza kuralları (olmayan özelliği satma, dış ödemeye yönlendirme, hesap silme, gizlilik), test ve derleme sonuçları.
- **Çıktı:** öncelik sırasıyla (Kritik / Önemli / Küçük) dürüst bir liste; her madde için dosya:satır ve öneri.
