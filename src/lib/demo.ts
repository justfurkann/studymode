import { generateLocally } from './localGenerator'

export const DEMO_COURSE_NAME = 'Psikolojiye Giriş (örnek)'
export const DEMO_NOTE_TITLE = 'Öğrenme ve bellek'

export const DEMO_NOTE_CONTENT = `Öğrenme ve Bellek

Öğrenme: Deneyim sonucunda bilgi veya davranışta ortaya çıkan görece kalıcı değişimdir. Öğrenme, yalnızca bilgiyi okumayı değil, bilgiyi anlamlandırmayı ve gerektiğinde kullanabilmeyi içerir.

Çalışma belleği: Bilgiyi kısa bir süre boyunca tutan ve üzerinde işlem yapmamızı sağlayan bellek sistemidir. Çalışma belleğinin kapasitesi sınırlıdır; aynı anda çok fazla yeni bilgi sunulması öğrenmeyi zorlaştırabilir.

Uzun süreli bellek: Bilgilerin, becerilerin ve deneyimlerin uzun zaman boyunca saklandığı bellek sistemidir. Yeni bilgiyi önceki bilgilerle ilişkilendirmek, uzun süreli bellekte daha anlamlı bağlantılar kurulmasına yardımcı olur.

Aktif hatırlama: Öğrenilen bilgiyi kaynağa bakmadan zihinden geri getirme çabasıdır. Notları kapatıp bir konuyu kendi cümlelerinle açıklamak veya deneme soruları çözmek aktif hatırlamaya örnektir. Bu yöntem, yalnızca tekrar okumaya kıyasla bilginin kalıcılığını artırabilir.

Aralıklı tekrar: Çalışma oturumlarını tek bir uzun oturum yerine zamana yayma yöntemidir. Bir konuyu bugün, birkaç gün sonra ve bir hafta sonra tekrar etmek aralıklı tekrara örnektir. Tekrarlar arasındaki uygun süre, bilginin zorluğuna ve ne kadar süre hatırlanmak istendiğine bağlıdır.

Geri bildirim: Bir yanıtın doğruluğu ve nasıl geliştirilebileceği hakkında verilen bilgidir. Test sonrasında yanlış cevabın neden yanlış olduğunu incelemek, yanlış bilgilerin düzeltilmesine yardımcı olur. Sadece puanı görmek yerine çözümün mantığını değerlendirmek öğrenmeyi destekler.

Üstbiliş: Kişinin kendi düşünme ve öğrenme süreçlerini izlemesi ve düzenlemesidir. Bir öğrenci hangi konuları bildiğini ve hangi konularda zorlandığını değerlendirerek çalışma planını değiştirebilir. Kendini test etmek, öğrenme düzeyini yalnızca tanıdıklık hissine göre değerlendirmekten daha somut bilgi sağlar.

Bilgiyi yeni bir duruma uygulamak, öğrenmenin aktarımını destekler. Örneğin bir öğrenci aralıklı tekrar ilkesini kullanarak haftalık ders çalışma programını düzenleyebilir. Etkili bir çalışma oturumu, kısa bir tekrarın ardından aktif hatırlama ve geri bildirim aşamalarını içerebilir.`


/** A curated, ready-made example; no model call or claim of live generation. */
export function createDemoSet() {
  const set = generateLocally(DEMO_NOTE_CONTENT)
  set.summary.overview = 'Öğrenmek yalnızca notları tekrar okumak değildir. Bilgiyi hafızadan çağırmak, tekrarları zamana yaymak ve yanlışları geri bildirimle düzeltmek kalıcı öğrenmeyi destekler. Bu önceden hazırlanmış örnek, bir çalışma setinde neler bulabileceğini gösterir.'
  set.summary.origin = 'demo'
  set.questions = [
    {
      prompt: 'Hangisi aktif hatırlamaya örnektir?',
      options: ['Notların altını tekrar çizmek', 'Notu kapatıp konuyu kendi sözlerinle anlatmak', 'Notları açık tutarak kopyalamak', 'Tek seferde uzun süre okumak'],
      answerIndex: 1,
      explanation: 'Aktif hatırlama, bilgiyi kaynağa bakmadan geri getirmektir. Tekrar okumak aynı hatırlama çabasını gerektirmez.',
      source: 'Aktif hatırlama: Öğrenilen bilgiyi kaynağa bakmadan zihinden geri getirme çabasıdır.',
    },
    {
      prompt: 'Bir konuyu bugün, üç gün sonra ve bir hafta sonra çalışmak hangi yaklaşımı örnekler?',
      options: ['Aralıklı tekrar', 'Tek oturumda çalışma', 'Çalışma belleğini doldurma', 'Yalnızca tanıdıklığa güvenme'],
      answerIndex: 0,
      explanation: 'Aralıklı tekrar, çalışma oturumlarını zamana yayar; tek uzun oturumdan farklıdır.',
      source: 'Aralıklı tekrar: Çalışma oturumlarını tek bir uzun oturum yerine zamana yayma yöntemidir.',
    },
    {
      prompt: 'Bir testten sonra öğrenmeyi destekleyen adım hangisidir?',
      options: ['Yalnızca toplam puana bakmak', 'Yanlışları atlayıp bitirmek', 'Yanlış cevabın neden yanlış olduğunu incelemek', 'Bütün cevapları ezberlemek'],
      answerIndex: 2,
      explanation: 'Geri bildirim, yanlış bilgilerin düzeltilmesine ve çözümün mantığının anlaşılmasına yardımcı olur.',
      source: 'Test sonrasında yanlış cevabın neden yanlış olduğunu incelemek, yanlış bilgilerin düzeltilmesine yardımcı olur.',
    },
    {
      prompt: 'Öğrencinin zorlandığı konuları fark edip planını değiştirmesi hangi kavramla ilişkilidir?',
      options: ['Yalnızca uzun süreli bellek', 'Tekrar okumak', 'Bilgiyi kopyalamak', 'Üstbiliş'],
      answerIndex: 3,
      explanation: 'Üstbiliş kişinin kendi öğrenmesini izlemesi ve düzenlemesidir.',
      source: 'Üstbiliş: Kişinin kendi düşünme ve öğrenme süreçlerini izlemesi ve düzenlemesidir.',
    },
    {
      prompt: 'Aynı anda çok fazla yeni bilgiyle çalışmak neden zorlaşabilir?',
      options: ['Uzun süreli bellek hiç bilgi saklamaz', 'Aralıklı tekrar bilgileri siler', 'Çalışma belleğinin kapasitesi sınırlıdır', 'Geri bildirim öğrenmeyi engeller'],
      answerIndex: 2,
      explanation: 'Çalışma belleği bilgiyi kısa süre tutar ve işler; kapasitesi sınırlı olduğu için yoğun bilgi yükü öğrenmeyi zorlaştırabilir.',
      source: 'Çalışma belleğinin kapasitesi sınırlıdır; aynı anda çok fazla yeni bilgi sunulması öğrenmeyi zorlaştırabilir.',
    },
  ].map(q => ({ ...q, id: crypto.randomUUID() }))
  set.practice = [{ id: crypto.randomUUID(), question: 'Bir haftalık çalışma planında aktif hatırlama, aralıklı tekrar ve geri bildirimi nasıl bir araya getirirsin?', hint: 'Tek bir uzun oturum yerine farklı günler ve her oturumdan sonra bir kontrol düşün.', answer: 'İlk gün konuyu okuyup notu kapatarak anlatırım. Birkaç gün sonra sorularla yeniden hatırlamayı denerim. Yanlış cevaplarımın açıklamalarını inceler, zorlandığım konuları sonraki tekrara eklerim. Hafta sonunda yeniden kendimi test ederim.' }]
  return set
}
