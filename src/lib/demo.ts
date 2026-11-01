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
  set.summary.mnemonics = [
    {
      id: 'demo-mn-1',
      kind: 'akrostis',
      title: 'Kalıcı Öğrenmenin 4 Adımı — Baş Harf Şifresi',
      code: 'A · A · G · Ü',
      breakdown: [
        { key: 'A → Aktif hatırlama', meaning: 'Notu kapatıp bilgiyi zihinden geri çağırma çabası.' },
        { key: 'A → Aralıklı tekrar', meaning: 'Tek uzun oturum yerine çalışmayı farklı günlere yayma.' },
        { key: 'G → Geri bildirim', meaning: 'Yanlış cevabın neden yanlış olduğunu inceleyip düzeltme.' },
        { key: 'Ü → Üstbiliş', meaning: 'Hangi konuyu bilip hangisinde zorlandığını fark edip planı güncelleme.' },
      ],
      tip: 'Sınavda “Etkili çalışma stratejileri nelerdir?” sorusu geldiğinde kağıdın kenarına A-A-G-Ü yaz.',
    },
    {
      id: 'demo-mn-2',
      kind: 'tekerleme',
      title: 'Bellek ve Hatırlama — Ritmik Dörtlük',
      code: 'Çalışma belleği dar, bilgiyi kısa tutar,\nUzun süreli bellek bağ kurdukça yutar.\nKapat notu zihinden çağır: Aktif hatırlama,\nZamana yay tekrarı, son geceye sıkıştırma!',
      breakdown: [
        { key: '1. Dize · Çalışma belleği', meaning: 'Kapasitesi sınırlıdır; bilgiyi kısa süre tutar ve işler.' },
        { key: '2. Dize · Uzun süreli bellek', meaning: 'Önceki bilgilerle anlamlı bağ kurulduğunda kalıcı saklar.' },
        { key: '3. Dize · Aktif hatırlama', meaning: 'Kaynağa bakmadan hatırlama çabası kalıcılığı artırır.' },
        { key: '4. Dize · Aralıklı tekrar', meaning: 'Oturumları zamana yaymak sıkıştırılmış çalışmadan etkilidir.' },
      ],
      tip: 'İki bellek türünü ve iki çalışma tekniğini tek dörtlükte ritimli okuyarak eşleştir.',
    },
    {
      id: 'demo-mn-3',
      kind: 'hikaye',
      title: 'Bilginin Bellekteki Yolculuğu — Hikâye Zinciri',
      code: 'Çalışma Belleği → Uzun Süreli Bellek → Aktif Hatırlama → Geri Bildirim',
      breakdown: [
        { key: '1. Durak: Giriş Kapısı (Çalışma belleği)', meaning: 'Yeni bilgi önce dar bir masa olan çalışma belleğine gelir.' },
        { key: '2. Durak: Arşiv Odası (Uzun süreli bellek)', meaning: 'Eski bilgilerle bağ kurulursa geniş arşive taşınır.' },
        { key: '3. Durak: Geri Çağırma (Aktif hatırlama)', meaning: 'Notu kapatıp kendini sınadığında arşivden geri çağrılır.' },
        { key: '4. Durak: Kalite Kontrol (Geri bildirim)', meaning: 'Yanlışların nedeni incelenerek hatalı bağlantılar onarılır.' },
      ],
      tip: 'Bilgiyi dar bir masadan büyük bir kütüphaneye taşıyan 4 duraklı bir yolculuk olarak hayal et.',
    },
  ]
  // A hand-written example of the detailed "Tam özet", so the page can be seen without AI.
  set.summary.detailed = {
    intro:
      'Bu not, öğrenmenin ne olduğunu, bilginin hangi bellek sistemlerinde tutulduğunu ve kalıcı öğrenmeyi destekleyen çalışma yöntemlerini anlatır. Bellek sistemleri "bilgi nerede durur" sorusunu, çalışma yöntemleri ise "bilgiyi oraya nasıl kalıcı taşırız" sorusunu cevaplar.',
    sections: [
      {
        heading: 'Öğrenme nedir?',
        paragraphs: [
          'Öğrenme, deneyim sonucunda bilgi veya davranışta ortaya çıkan görece kalıcı değişimdir. Buradaki kilit kelime "kalıcı"dır: bir şeyi bir kez okuyup anlamak öğrenmenin başlangıcıdır, ama bilgiyi gerektiğinde kullanabilmek öğrenmenin kendisidir.',
        ],
        bullets: ['Öğrenme = deneyimle oluşan görece kalıcı değişim.', 'Bilgiyi okumak yetmez; anlamlandırmak ve kullanabilmek gerekir.'],
        example: '',
      },
      {
        heading: 'Bellek sistemleri',
        paragraphs: [
          'Yeni bilgi önce çalışma belleğine gelir. Çalışma belleği bilgiyi kısa bir süre tutar ve üzerinde işlem yapmamızı sağlar, ama kapasitesi sınırlıdır: aynı anda çok fazla yeni bilgi gelirse öğrenme zorlaşır.',
          'Kalıcı olan bilgi uzun süreli bellekte saklanır. Yeni bilgiyi önceden bildiklerimizle ilişkilendirmek, uzun süreli bellekte daha anlamlı bağlantılar kurulmasına yardım eder.',
        ],
        bullets: ['Çalışma belleği: kısa süreli, sınırlı kapasiteli, bilgiyi işler.', 'Uzun süreli bellek: bilgi, beceri ve deneyimleri uzun süre saklar.', 'Yeni bilgiyi eskisine bağlamak kalıcılığı artırır.'],
        example: '',
      },
      {
        heading: 'Kalıcı öğrenmeyi destekleyen yöntemler',
        paragraphs: [
          'Aktif hatırlama, bilgiyi kaynağa bakmadan zihinden geri getirme çabasıdır ve yalnızca tekrar okumaktan daha etkilidir. Aralıklı tekrar, çalışmayı tek uzun oturum yerine zamana yaymaktır; tekrarlar arasındaki uygun süre bilginin zorluğuna ve ne kadar süre hatırlanmak istendiğine bağlıdır.',
          'Geri bildirim, bir yanıtın doğruluğu ve nasıl geliştirileceği hakkındaki bilgidir; puana bakmak yerine yanlışın nedenini incelemek öğrenmeyi destekler. Üstbiliş ise kişinin kendi öğrenmesini izleyip düzenlemesidir.',
        ],
        bullets: ['Aktif hatırlama: notu kapatıp hatırlamaya çalışmak.', 'Aralıklı tekrar: bugün, birkaç gün sonra, bir hafta sonra.', 'Geri bildirim: yanlışın nedenini anlamak.', 'Üstbiliş: neyi bilip neyi bilmediğini fark edip planı değiştirmek.'],
        example: 'Notları kapatıp konuyu kendi cümlelerinle anlatmak ya da deneme sorusu çözmek aktif hatırlamadır; bir konuyu bugün, birkaç gün sonra ve bir hafta sonra tekrar etmek aralıklı tekrardır.',
      },
      {
        heading: 'Öğrendiğini yeni duruma uygulamak',
        paragraphs: ['Bilgiyi yeni bir duruma uygulamak öğrenmenin aktarımını destekler. Bu yöntemleri bilmek kadar onları kendi çalışma planına uygulamak da önemlidir.'],
        bullets: [],
        example: 'Bir öğrenci aralıklı tekrar ilkesini kullanarak haftalık ders çalışma programını düzenleyebilir.',
      },
    ],
    takeaways: [
      'Çalışma belleği ile uzun süreli belleği karıştırma: biri kısa süreli ve sınırlı, diğeri kalıcı depodur.',
      'Tekrar okumak aktif hatırlama değildir; kaynağa bakmadan hatırlamak gerekir.',
      'Aralıklı tekrarda tekrar sayısı kadar aradaki süre de önemlidir.',
      'Geri bildirimde amaç puan değil, yanlışın nedenini anlamaktır.',
    ],
    createdAt: new Date().toISOString(),
  }
  set.summary.comparisons = [
    {
      id: 'demo-cmp-1',
      leftTerm: 'Çalışma belleği',
      leftPoint: 'Bilgiyi kısa süre tutar, üzerinde işlem yapar ve kapasitesi sınırlıdır.',
      rightTerm: 'Uzun süreli bellek',
      rightPoint: 'Bilgi, beceri ve deneyimleri anlamlı bağlarla uzun zaman saklar.',
      difference: 'Çalışma belleği anlık ve sınırlı işlem alanıdır; uzun süreli bellek ise kalıcı depodur.',
      examTrap: '“Aynı anda çok fazla yeni bilgi verildiğinde zorlanma” sorulursa cevap uzun süreli bellek değil, çalışma belleğinin sınırlı kapasitesidir.',
    },
    {
      id: 'demo-cmp-2',
      leftTerm: 'Aktif hatırlama',
      leftPoint: 'Kaynağa bakmadan bilgiyi zihinden geri getirme ve kendini test etme çabasıdır.',
      rightTerm: 'Tekrar okuma (Pasif tekrar)',
      rightPoint: 'Notları açık tutup yeniden gözden geçirme veya altını çizme işlemidir.',
      difference: 'Aktif hatırlama zihinsel geri çağırma gerektirir; tekrar okuma yalnızca tanıdıklık hissi yaratır.',
      examTrap: 'Şıklarda “notların altını renkli kalemle çizmek” aktif hatırlama gibi sunulur; oysa kaynak açıksa aktif hatırlama değildir.',
    },
  ]
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
