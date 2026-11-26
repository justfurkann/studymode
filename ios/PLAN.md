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
| — | Açılış akışı: 3 tanıtım sayfası, "Seni tanıyalım" (seviye → `user_metadata.education`, site gibi v2), sonra kayıt; bot doğrulaması arka planda ve görünmez | ✅ 26 Kasım |
| — | Yeni Tekrar (kalite kontrol önerisi): günlük hedef 15, günde en fazla 5 yeni, sıra (sınav → bilinemeyen → gecikmiş → yeni), "Bugün tamam" + "Biraz daha", ders bazında hazırlık (sitenin `examReadiness`'i birebir) | ✅ kodlandı 26 Kasım; giriş yapılmış ekranda henüz görülmedi |
| 5 | Test (sorular, `quiz_attempts`, son sonuç, tekrar çöz) | sırada |
| 6 | Not ekleme: metin, fotoğraf (sayfa okuma), PDF; hazırlama 12.000 karakterlik parçalar, 3 aynı anda | |
| 7 | Toparlama: hata mesajları, boş ekranlar, erişilebilirlik, birim testleri | |

## Bekleyenler (dış engel)

- **Ücretli Apple ekibi** (ödeme 26 Kasım, hesaba yansıması 48 saate kadar): yeni Team ID → site doğrulama dosyasını günceller (IOS_SYNC madde 4); Xcode'da ekip değişir; telefona `fun.studymode.app` kimliğiyle, Apple ile giriş ve `webcredentials` açık yüklenir. O güne kadar telefona yükleme `fun.studymode.app.dev` kimliği ve boş yetki dosyasıyla, komut satırından yapılıyor (proje ayarı değişmiyor).
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

**Diğer küçük notlar**
- Kart turu "son tekrarı geri al" ve "karıştır" (sitede var, uygulamada yok).
- Site ve uygulama aynı anda açıkken `study_days` günlük sayacında birkaç tekrar kaybolabilir (kartlar kaybolmaz).
- Formüller Unicode ile çiziliyor; büyük matris/tabloda zayıf. Gerekirse yalnızca formül olan yerlerde KaTeX (web görünümü).
