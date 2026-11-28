# StudyMode — Claude Code için kısa rehber

## Proje

- **studymode.fun**: öğrencinin ders notlarından yapay zekâ ile özet, kart, test ve sınav provası çıkaran çalışma sitesi. Arayüz ve belgeler Türkçe.
- **Site:** Vite + React + TypeScript (`src/`). Sunucu uçları Vercel fonksiyonları (`api/`, ör. `/api/generate`, `/api/delete-account`, `/api/apple-*`).
- **Veri:** Supabase (giriş + Postgres). Şema ve fonksiyonlar `supabase/schema.sql` içinde.
- **iPhone:** `ios/` klasöründe native SwiftUI uygulaması (`ios-taslak` dalı), aynı Supabase ve `/api/generate`.
- **Android:** planlanıyor (Kotlin + Jetpack Compose, paket `fun.studymode.app`). Plan `android/PLAN.md`, `android-taslak` dalında (main'de `android/` yok).

## Ekip düzeni (kısaca)

- İş rollere bölünür: Site, iPhone, Android, Kalite kontrol. Her rol kendi worktree'sinde ve dalında çalışır, başka rolün klasörüne dokunmaz.
- Site ↔ uygulama haberleşmesi: `docs/IOS_SYNC.md` ve `docs/ANDROID_SYNC.md`.
- Önce `docs/STATE.md`'yi oku (kırmızı çizgiler, güncel durum); arşiv `docs/HANDOFF.md`. Bu dosya STATE.md'nin yerine geçmez.
- **Rolüne göre `docs/ROLES.md`'yi oku** (ortak kurallar + rolünün bölümü): neyi okursun, neye dokunursun, hangi dalda çalışırsın, defterin nerede.

## Dört kontrol (siteye dokunan her değişiklikte)

```sh
npm test                        # vitest run
npm run build                   # tsc -b && tsc -p tsconfig.api.json && vite build
npx tsc -p tsconfig.api.json    # api/ tip kontrolü
npm run test:e2e                # playwright test
```

İlk sefer: `npm install` ve `npx playwright install chromium`.

## Commit ve PR kuralları

- **`main`'e birleştirme yok.** Dal açılır, PR açılır; PR'ı kullanıcı birleştirir. Auto-merge açılmaz.
- Site dalları `origin/main`'den açılır: `claude/site-<konu>`.
- Commit ve PR metinlerine yapay zekâ **model adı yazılmaz** (Co-Authored-By satırı dahil).
- `package-lock.json` değişikliği commit'lenmez (bilerek bağımlılık eklenmediyse).
- Sabit sürüm/numaralar kendiliğinden artırılmaz.
- **Gizli anahtar istenmez**, sohbete yapıştırılması önerilmez. Anahtar gereken iş "kullanıcının panel işi" diye yazılır.
- Veritabanı değişikliği (SQL) çalıştırılmaz: `supabase/schema.sql`'e yazılır, kullanıcıya hangi SQL'i nerede çalıştıracağı söylenir.

## Veri kuralları (bozulmasın)

- `study_days` yalnızca `bump_study_day` RPC ile artırılır (insert/upsert/update yok).
- Yapay zekâ talimatları (`src/lib/ai/tasks.ts`) testlerle korunmaz; değişirse canlıda gerçek notla denenmeli.

## İş bitince

Kendi defterine (Site için `docs/HANDOFF.md`'de yeni "Aşama N") dört başlık: **Yapılan · Kararlar · İşe yaramayan · Sıradaki**; `docs/STATE.md`'deki ilgili satır da güncellenir.

## Görsel / animasyon araçları ve iş bölümü (Rive, Lottie, ShipSwift)

- Projede artık **Rive**, **Lottie** ve **ShipSwift** ile çalışıyoruz.
- Bu araçlarla ilgili işleri kullanıcı bilinçli **iş bölümü** olarak Codex tarafında yaptırıyor; ihtiyaç gördüğünde *"bunu Codex'te Rive / Lottie / ShipSwift ile yaptıralım"* diye söylemen yeterli.
- **Proaktif öneri kuralı (tüm ajanlar için):** Bir özellik, ekran veya animasyon yaparken saf kodla çözmek yerine bir araç/paket (Rive, Lottie, ShipSwift vb.) belirgin şekilde daha iyi sonuç verecekse, kullanıcıya mutlaka söyle: *"Bunu kodla yaparım ama istersen … ekleyip onunla yapalım, çok daha iyi olur."*
