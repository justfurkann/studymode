# Android ↔ Site haberleşme defteri

Android Claude'u (`android/`, `android-taslak` dalı) ile Site Claude'u arasındaki iş listesi. Kurallar `docs/HANDOFF.md` → "0. Ekip düzeni" ve `docs/ROLES.md`. Android oturumu bu dosyaya doğrudan yazmaz; siteden bekledikleri yönetici aracılığıyla buraya eklenir (dosya site tarafında). En yeni giriş en üstte. Bir iş bitince satırına ✅ ve tarih eklenir; silinmez.

## Sabit bilgiler (uygulama tarafı)

| | |
|---|---|
| Paket adı | `fun.studymode.app` |
| Google Cloud proje numarası | `189951485932` (gizli değil) |
| Android OAuth istemci kimliği | Henüz yok (Google ile giriş için kullanıcının panel işi) |
| Supabase istemcisi | `supabase-kt`, publishable anahtar |
| Yapay zekâ | Aynı `/api/generate` (yeni backend yok) |

## Uygulamanın siteden beklediği işler

Henüz yok.

## Sitenin uygulamadan beklediği işler

### Önemli kural: `study_days` yalnızca `bump_study_day` RPC ile yazılır

- Uygulama `study_days`'e satır insert/upsert/update etmez; her kart cevabında, test bitiminde ve "actions"ta `bump_study_day` fonksiyonunu çağırır. Gün = cihazın yerel günü (site ile aynı).
- Çağrının biçimi, dönen satır ve geri alma: `docs/IOS_SYNC.md` → "Sitenin uygulamadan beklediği işler" → **"A. `study_days` artık yalnızca artışla yazılır"** (aynı kural Android için de geçerli).
