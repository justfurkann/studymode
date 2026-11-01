/*
 * "Hangi öğrenci tipisin?": a 10-question quiz with a result worth sharing.
 *
 * Not the usual "you picked mostly A". Every answer moves the student on four axes (how they plan,
 * why they study, with whom, and when) plus a hidden "style" trait, and the result is the type whose
 * profile is closest to theirs. So the card can say *why*: the axis bars, the runner-up type and how
 * close each was. Pure and tested; the page only shows it.
 */

export type Level = 'ortaokul' | 'lise' | 'universite' | 'yukseklisans' | 'mezun'

export const LEVELS: Array<{ id: Level; label: string; hint: string }> = [
  { id: 'ortaokul', label: 'Ortaokul', hint: 'LGS yolcusu' },
  { id: 'lise', label: 'Lise', hint: 'Yazılılar, YKS' },
  { id: 'universite', label: 'Üniversite', hint: 'Vize, final, bütünleme' },
  { id: 'yukseklisans', label: 'Yüksek lisans / doktora', hint: 'Tez, makale, seminer' },
  { id: 'mezun', label: 'Mezun / çalışıyorum', hint: 'Sertifika, KPSS, kendimi geliştiriyorum' },
]

/** Levels that pick a university. */
export const hasUniversity = (level: Level | null) => level === 'universite' || level === 'yukseklisans'

/** The word for "exam" at each level, so questions sound like the student's own life. */
/** Turkish suffixes follow the word, so each form is written out: "vizeye", "yazılıya", "sınava". */
export interface ExamWords {
  exam: string
  /** Dative: "vizeye". */
  toExam: string
  /** Locative: "vizede". */
  inExam: string
  teacher: string
}

/** Option text for this level. */
export const optionText = (option: Question['options'][number], w: ExamWords) => (typeof option.text === 'string' ? option.text : option.text(w))

export function examWord(level: Level | null): ExamWords {
  if (level === 'ortaokul' || level === 'lise') return { exam: 'yazılı', toExam: 'yazılıya', inExam: 'yazılıda', teacher: 'öğretmen' }
  if (level === 'mezun') return { exam: 'sınav', toExam: 'sınava', inExam: 'sınavda', teacher: 'eğitmen' }
  return { exam: 'vize', toExam: 'vizeye', inExam: 'vizede', teacher: 'hoca' }
}

/** plan: planlı (+) ↔ akışına (−) · depth: anlamak (+) ↔ sonucu almak (−) · social: grupla (+) ↔ yalnız (−) · night: gece (+) ↔ sabah (−) · style: estetik notlar (+) */
export type Axis = 'plan' | 'depth' | 'social' | 'night' | 'style'
export type Vector = Record<Axis, number>
const ZERO: Vector = { plan: 0, depth: 0, social: 0, night: 0, style: 0 }

export interface Option {
  text: string
  delta: Partial<Vector>
}

/** Picture for an option; the page maps it to an icon. */
export type OptionIcon =
  | 'calendar' | 'shuffle' | 'search' | 'chat'
  | 'sunrise' | 'coffee' | 'snooze' | 'moon'
  | 'theory' | 'fastforward' | 'ask' | 'headphones'
  | 'palette' | 'bell' | 'minimal' | 'folders'
  | 'lamp' | 'swap' | 'users' | 'window'
  | 'mic' | 'ghost' | 'clock' | 'early'
  | 'bed' | 'zap' | 'bus' | 'target'
  | 'gear' | 'play' | 'friends' | 'brush'
  | 'list' | 'book' | 'scale' | 'wave'
  | 'stop' | 'tv' | 'send' | 'walk'

export interface Question {
  id: string
  text: (w: ExamWords) => string
  options: Array<
    Omit<Option, 'text'> & {
      text: string | ((w: ExamWords) => string)
      icon: OptionIcon
      /** A one-line reaction shown for a moment after picking it. */
      react: string
    }
  >
}

/*
 * Questions from everyday life, not from the classroom: a quiz people take for fun and recognise
 * themselves in. Each option keeps the axis weights the scoring was balanced with, so only the
 * situations changed: "plans the weekend to the hour" moves "plan" exactly like "plans study days" did.
 */
export const QUESTIONS: Question[] = [
  {
    id: 'haftasonu',
    text: () => 'Cuma akşamı. Hafta sonu planın?',
    options: [
      { text: "Cumartesi 10'da kahvaltı, 2'de sinema; hepsi notlarda", delta: { plan: 2, social: -0.5 }, icon: 'calendar', react: 'Saat saat. Saygı duyduk.' },
      { text: 'Plan mı? Kalkınca bakarız', delta: { plan: -2 }, icon: 'shuffle', react: 'Özgür ruh tespit edildi.' },
      { text: 'Merak ettiğim bir belgeseli baştan sona izlerim', delta: { depth: 1.5, social: -1 }, icon: 'search', react: 'Bir bölüm, üç Wikipedia sekmesi.' },
      { text: 'Gruba "kim ne yapıyor?" diye ilk ben yazarım', delta: { social: 2 }, icon: 'chat', react: 'Grubun motoru sensin.' },
    ],
  },
  {
    id: 'alarm',
    text: () => 'Sabah alarm çaldı. Sen?',
    options: [
      { text: 'Alarmdan önce uyandım zaten, güne hazırım', delta: { night: -2 }, icon: 'sunrise', react: 'Güneşle yarışan biri.' },
      { text: 'Kalkıyorum ama ilk iş gruba "günaydın"', delta: { night: -0.5, social: 1 }, icon: 'coffee', react: 'Günaydın mesajları kutsaldır.' },
      { text: 'Üç kez erteliyorum; gece daha verimliydim', delta: { night: 1 }, icon: 'snooze', react: '"5 dakika daha" klasiği.' },
      { text: 'Alarm mı? Ben daha yatmadım ki', delta: { night: 1.5, plan: -1 }, icon: 'moon', react: 'Gece vardiyası onaylandı.' },
    ],
  },
  {
    id: 'dizi',
    text: () => 'İzlediğin dizide olayı kaçırdın. Ne yaparsın?',
    options: [
      { text: 'Fan teorilerini okurum, her detayı çözene kadar', delta: { depth: 2, social: -1 }, icon: 'theory', react: 'Dedektif modu açıldı.' },
      { text: 'Özet videosunu 2x hızda izlerim, bitsin', delta: { depth: -2 }, icon: 'fastforward', react: 'Verimlilik budur.' },
      { text: 'Arkadaşa "ne oldu şimdi?" diye yazarım', delta: { social: 1.5, depth: 0.5 }, icon: 'ask', react: 'O arkadaş seni seviyor.' },
      { text: 'Kulaklığı takar, kendi başıma geri sararım', delta: { social: -0.5 }, icon: 'headphones', react: 'Sen ve dizi, baş başa.' },
    ],
  },
  {
    id: 'anaekran',
    text: () => 'Telefonunun ana ekranı nasıl?',
    options: [
      { text: 'Renk temalı ikonlar, widget’lar; her şey estetik', delta: { style: 2, plan: 0.5 }, icon: 'palette', react: 'Pinterest seni takip ediyor.' },
      { text: '120 bildirim, dağınık klasörler; ama ben bulurum', delta: { plan: -1, style: -0.5 }, icon: 'bell', react: 'Düzenli kaos.' },
      { text: 'Varsayılan duvar kâğıdı, ne lazımsa o', delta: { depth: -1.5, style: -1 }, icon: 'minimal', react: 'İş görsün yeter.' },
      { text: 'Klasörler konu konu, her şeyin bir mantığı var', delta: { depth: 1.5, plan: 0.5 }, icon: 'folders', react: 'Kütüphaneci ruhlu.' },
    ],
  },
  {
    id: 'kafe',
    text: () => 'Kafeye girdin. Hangi masa?',
    options: [
      { text: 'Köşedeki tek kişilik masa; kahve, ajanda, düzen', delta: { plan: 1.5, social: -0.5 }, icon: 'lamp', react: 'Senin masan hep boş bekler.' },
      { text: 'Gelince karar veririm, üç kez yer değiştiririm', delta: { plan: -1.5 }, icon: 'swap', react: 'Garson seni tanıyor artık.' },
      { text: 'En büyük masa; kim gelirse otursun', delta: { social: 2 }, icon: 'users', react: 'Masa senden sorulur.' },
      { text: 'Cam kenarı, kulaklık takılı, akşamüstü', delta: { night: 1, social: -1 }, icon: 'window', react: 'Film sahnesi gibi.' },
    ],
  },
  {
    id: 'grup',
    text: () => 'Arkadaş grubunda sen hangisisin?',
    options: [
      { text: 'Bir konu açıp herkese anlatan', delta: { social: 2, depth: 1 }, icon: 'mic', react: 'Podcast açsan dinlerler.' },
      { text: 'Sessizce okuyan, ayda bir "haha" atan', delta: { social: -2 }, icon: 'ghost', react: 'Gizli izleyici.' },
      { text: 'Sadece "ne zaman, nerede?" kısmında ortaya çıkan', delta: { social: 0.5, depth: -1 }, icon: 'clock', react: 'Lojistik müdürü.' },
      { text: 'Hep erkenden gelip herkesi bekleyen', delta: { social: -1.5, plan: 0.5, night: -0.5 }, icon: 'early', react: 'Bir gün biri de seni bekleyecek.' },
    ],
  },
  {
    id: 'sabah',
    text: (w) => `${cap(w.exam)} sabahı. Neredesin?`,
    options: [
      { text: 'Uyumuşum, kahvaltıda son bir göz gezdiriyorum', delta: { plan: 1.5, night: -0.5 }, icon: 'bed', react: 'Sakinlik sende doğuştan.' },
      { text: 'Hiç uyumadım, son üç konuyu yetiştiriyorum', delta: { plan: -2, night: 1.5 }, icon: 'zap', react: 'Adrenalin, en iyi kahve.' },
      { text: 'Yolda arkadaşlara soru soruyorum, onlar bana', delta: { social: 1.5 }, icon: 'bus', react: 'Otobüs bir sınıf oldu.' },
      { text: 'Çıkmış sorulara son kez bakıyorum', delta: { depth: -1.5, plan: 0.5 }, icon: 'target', react: 'Hedef belli.' },
    ],
  },
  {
    id: 'oyun',
    text: () => 'Yeni bir oyun indirdin. İlk ne yaparsın?',
    options: [
      { text: 'Nasıl çalıştığını çözene kadar her menüyü kurcalarım', delta: { depth: 2, social: -0.5 }, icon: 'gear', react: 'Kılavuzu yazan sen olabilirsin.' },
      { text: 'Hemen oynamaya başlarım, gerisi gelir', delta: { depth: -1.5 }, icon: 'play', react: 'Eğitim bölümü? Geç.' },
      { text: 'Arkadaşları da indirtirim, birlikte oynarız', delta: { social: 1.5, depth: 0.5 }, icon: 'friends', react: 'Lobi doldu.' },
      { text: 'Önce karakterimi ve temayı ayarlarım', delta: { style: 1.5, depth: -1 }, icon: 'brush', react: 'Görünüş her şeydir.' },
    ],
  },
  {
    id: 'yilbasi',
    text: () => 'Yeni yıl kararın?',
    options: [
      { text: 'Liste hazır, ajanda bile aldım. (Bu sefer gerçekten.)', delta: { plan: 1.5, style: 0.5 }, icon: 'list', react: 'Ajanda sana güveniyor.' },
      { text: 'Yeni bir şey öğreneceğim: dil, enstrüman, ne olursa', delta: { depth: 2 }, icon: 'book', react: 'Merak bitmez.' },
      { text: 'Gerçekçi olalım: ne lazımsa o, fazlası değil', delta: { depth: -2, plan: 0.5 }, icon: 'scale', react: 'Ayakları yere basan biri.' },
      { text: 'Karar mı? Akışına bırakırım', delta: { plan: -2 }, icon: 'wave', react: 'Dalgayla birlikte.' },
    ],
  },
  {
    id: 'bolum',
    text: () => 'Saat 01.00. Ekranda "Sonraki bölüm" geri sayıyor.',
    options: [
      { text: 'Kapatırım. Yarın da gün var.', delta: { plan: 2 }, icon: 'stop', react: 'İrade abidesi.' },
      { text: 'Tabii ki izlerim. Sezon bitti, güneş doğdu.', delta: { plan: -2, night: 1 }, icon: 'tv', react: 'Klasik. Biz de öyleyiz.' },
      { text: 'Durdurup arkadaşa "bu sahneyi gördün mü" yazarım', delta: { social: 1.5 }, icon: 'send', react: 'Spoiler’a dikkat.' },
      { text: 'Kapatıp gece yürüyüşüne çıkarım', delta: { night: 1, social: -1.5 }, icon: 'walk', react: 'Gece senin.' },
    ],
  },
]

function cap(word: string) {
  return word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1)
}

export type TypeId = 'ajanda' | 'sondakika' | 'gecekusu' | 'kasif' | 'anlatici' | 'fosforlu' | 'avci' | 'maratoncu'

export interface StudentType {
  id: TypeId
  name: string
  tagline: string
  /** "Bu tam sen": three things this type will recognise right away. */
  you: [string, string, string]
  /** Profile on the axes, each −1..1. */
  profile: Vector
  description: string
  strengths: [string, string]
  blindSpot: string
  tactic: string
  /** The type that complements this one best. */
  buddy: TypeId
  /** Character colours: body, accent. */
  colors: [string, string]
}

export const TYPES: Record<TypeId, StudentType> = {
  ajanda: {
    id: 'ajanda',
    name: 'Ajanda Stratejisti',
    tagline: 'Plan yoksa panik var.',
    you: ['Telefonunda en az üç farklı yapılacaklar uygulaması var.', 'Bir planın iptal olunca yeni bir plan yapmak için plan yaparsın.', 'Listedeki bir maddeyi çizmek sana kahveden daha çok enerji verir.'],
    profile: { plan: 1, depth: 0.3, social: 0.15, night: 0, style: 0.25 },
    description:
      'Sınav tarihini öğrendiğin gün geri sayım başlıyor. Konuları günlere böler, listedeki her maddeyi çizmenin keyfini yaşarsın. Sürprizleri sevmezsin; o yüzden sürpriz de yaşamazsın.',
    strengths: ['Son geceye hiçbir şey bırakmazsın', 'Uzun dönemi küçük, yapılabilir parçalara bölersin'],
    blindSpot: 'Plan bozulunca bütün gün gitti sanırsın. Planı yapmak bazen çalışmanın yerini tutuyor gibi gelir.',
    tactic: 'Planına "tekrar günleri" koy: her konuyu 1, 3 ve 7 gün sonra kısa bir testle yokla. Aralıklı tekrar senin planına zaten çok yakışıyor.',
    buddy: 'kasif',
    colors: ['#7aa7ff', '#1b2250'],
  },
  sondakika: {
    id: 'sondakika',
    name: 'Son Dakika Kahramanı',
    tagline: 'Baskı altında parlayan elmas.',
    you: ['"Yarın başlarım" senin en uzun soluklu ilişkin.', 'Sınavdan önceki gece gözlerinde bir film kahramanı ışıltısı var.', 'Teslim saatinden 3 dakika önce gönder tuşuna basmak senin sporun.'],
    profile: { plan: -1, depth: -0.5, social: 0, night: 0.7, style: -0.2 },
    description:
      'Bir hafta boyunca "yarın başlarım" dersin, son 24 saatte bir dönemi bitirirsin. Adrenalin senin kahven. İşin ilginci, çoğu zaman da geçersin; sistemi çökertmeyen bir kaosun var.',
    strengths: ['Kriz anında inanılmaz odaklanırsın', 'Neyin önemli olduğunu çabuk ayıklarsın'],
    blindSpot: 'Son gece öğrendiğin şey sınavdan bir hafta sonra uçup gider. Finalde aynı konuyu sıfırdan öğrenirsin.',
    tactic: 'Kahramanlığını bölüp dağıt: sınavdan önceki 5 güne günde 20 dakikalık "mini son dakikalar" koy. Adrenalin aynı, kalıcılık çok daha fazla.',
    buddy: 'ajanda',
    colors: ['#ff8a5c', '#1b2250'],
  },
  gecekusu: {
    id: 'gecekusu',
    name: 'Gece Kuşu Düşünür',
    tagline: 'Dünya uyurken sen anlıyorsun.',
    you: ['En güzel fikirlerin saat 02.00\'de, herkes uyurken geliyor.', 'Sabah derslerinde bedenin orada, ruhun hâlâ yatakta.', 'Gece sessizliği senin için en iyi çalışma müziği.'],
    profile: { plan: -0.2, depth: 0.7, social: -0.7, night: 1, style: 0 },
    description:
      'Gün boyu zihnin dağınık, ama ev sessizleşince bir şey açılıyor. Gece yalnız ve derin çalışırsın; sabaha karşı bir konuyu nihayet "çözdüğün" o an için yaşarsın.',
    strengths: ['Kesintisiz derin odak kurabilirsin', 'Konuların arkasındaki mantığı yakalarsın'],
    blindSpot: 'Uykusuzluk ertesi günü siliyor. Sınav sabah 9’daysa beyin henüz gecede.',
    tactic: 'Sınavdan 3 gün önce ritmini sabaha kaydır. Gece öğrendiklerini ertesi gün öğlen 10 dakikalık kartlarla yokla; uykuda pekişen bilgi sabah ortaya çıkar.',
    buddy: 'maratoncu',
    colors: ['#8b7cf6', '#ffe14d'],
  },
  kasif: {
    id: 'kasif',
    name: 'Meraklı Kaşif',
    tagline: 'Bir konu açtın, üç konu çıktı.',
    you: ['Bir soruyu araştırırken kendini 40 sekme sonra bambaşka bir konuda bulursun.', '"Bu sınavda çıkmaz" dense bile merak ettiysen okursun.', 'En sevdiğin cümle: "Peki ama neden?"'],
    profile: { plan: -0.5, depth: 1, social: -0.1, night: 0.2, style: 0 },
    description:
      '"Bu neden böyle?" sorusu seni ders kitabının dışına çıkarır. Bir kavramı gerçekten anladığında başkalarının ezberlediği yerde sen bağlantıları görürsün. Ama müfredat seni pek ilgilendirmez.',
    strengths: ['Ezberlemezsin, anlarsın; bu da kalıcı olur', 'Farklı konular arasında bağ kurarsın'],
    blindSpot: 'İlginç bir yan yolda saatler geçer, sınavda çıkacak konu yarım kalır.',
    tactic: 'Merakını sınava bağla: her çalışmadan önce 10 dakika eski sınav sorularına bak, sonra "neden"lerin peşine o sorulardan başla.',
    buddy: 'avci',
    colors: ['#3ccf91', '#1b2250'],
  },
  anlatici: {
    id: 'anlatici',
    name: 'Sınıfın Anlatıcısı',
    tagline: 'Anlatırken öğreniyorsun.',
    you: ['Sınavdan önce telefonun "bunu bir anlatır mısın?" mesajlarıyla dolar.', 'Bir şeyi anladığında birine anlatmadan içine sinmez.', 'Grup çalışması senin evin, sen de ev sahibisin.'],
    profile: { plan: 0.2, depth: 0.5, social: 1, night: -0.2, style: 0 },
    description:
      'Sınav öncesi grubun herkesi sana sorar, sen de anlatırken konuyu kendin pekiştirirsin. Bir şeyi başkasına anlatabiliyorsan onu bildiğini bilirsin. Sınıfın gayriresmî asistanısın.',
    strengths: ['Anlatarak öğrenmek en güçlü yöntemlerden biri', 'Grubu toparlar, motivasyonu yüksek tutarsın'],
    blindSpot: 'Herkese anlatırken kendi eksiklerine zaman kalmaz. Yalnızken odaklanmak zor gelir.',
    tactic: 'Grup çalışmasından önce 30 dakika yalnız, kendini test et; grupta da en zorlandığın konuyu sen anlat.',
    buddy: 'gecekusu',
    colors: ['#ff6fb5', '#1b2250'],
  },
  fosforlu: {
    id: 'fosforlu',
    name: 'Fosforlu Kalem Sanatçısı',
    tagline: 'Defterin Pinterest’e layık.',
    you: ['Kalemliğinde en az beş farklı renk fosforlu kalem var.', 'Güzel bir defter almak sana bir hafta motivasyon verir.', 'Arkadaşların sınavdan önce notlarının fotoğrafını ister.'],
    profile: { plan: 0.3, depth: -0.2, social: -0.1, night: 0, style: 1 },
    description:
      'Başlıklar renk kodlu, kenarlarda minik çizimler, beş farklı fosforlu kalem. Güzel bir sayfa sana çalışma isteği verir; arkadaşların sınavdan önce fotokopi için seni arar.',
    strengths: ['Bilgiyi düzenleyip görselleştirirsin', 'Görsel hafızan güçlü: sayfayı gözünde canlandırırsın'],
    blindSpot: 'Her yerin altı çizilince hiçbir yer önemli kalmaz. Sayfayı güzelleştirmek ezberlemek değildir.',
    tactic: 'Fosforlu kalemi en sona sakla: önce kapatıp hatırlamaya çalış, hatırlayamadığın yerleri işaretle. Böylece renkler gerçekten zayıf noktalarını gösterir.',
    buddy: 'anlatici',
    colors: ['#ffe14d', '#1b2250'],
  },
  avci: {
    id: 'avci',
    name: 'Verimlilik Avcısı',
    tagline: 'Minimum emek, maksimum not.',
    you: ['Hangi hocanın neyi sorduğunu herkesten önce sen bilirsin.', '"Çıkmış sorular" klasörün altın değerinde.', 'Gereksiz tek bir sayfa okumak sana fiziksel acı verir.'],
    profile: { plan: 0.4, depth: -1, social: 0, night: -0.2, style: -0.3 },
    description:
      'Hangi konudan kaç soru çıkıyor, hangi hoca neyi seviyor, hepsi kafanda. Çıkmış sorular senin hazine haritan. Hedef belli, rota kısa; gereksiz tek bir sayfa okumazsın.',
    strengths: ['Neyin sınavda çıkacağını iyi tahmin edersin', 'Zamanını çok verimli kullanırsın'],
    blindSpot: 'Soru tipi değişince ya da konu bir sonraki derste temel olunca açık verirsin.',
    tactic: 'Çıkmış sorularla başla ama her yanlışın "neden"ini bir karta yaz. Kartlar seni soru kalıbından kurtarıp konuyu kalıcı yapar.',
    buddy: 'kasif',
    colors: ['#4fd1e8', '#1b2250'],
  },
  maratoncu: {
    id: 'maratoncu',
    name: 'Sessiz Maratoncu',
    tagline: 'Her gün biraz, hiç durmadan.',
    you: ['Herkes panikteyken sen sakin sakin tekrar yaparsın.', 'Her gün aynı saatte, aynı yerde, aynı kahveyle.', 'Kimse fark etmeden dönemi bitirmiş olursun.'],
    profile: { plan: 0.35, depth: 0.35, social: -0.8, night: -1, style: 0 },
    description:
      'Gösterişsiz ama istikrarlısın. Sabah erken, her gün aynı saatte, sessizce. Sınav haftası herkes panikteyken sen tekrar yapıyorsun, çünkü öğrenme kısmını çoktan bitirdin.',
    strengths: ['İstikrar: her gün biraz, en güçlü yöntem', 'Sınav stresini en az yaşayan sensin'],
    blindSpot: 'Rutin bozulunca toparlanmak zor. Yalnız çalışırken yanlış anladığın bir şeyi fark etmeyebilirsin.',
    tactic: 'Rutinine haftada bir "deneme sınavı" ekle. Kendi kendine çalışırken kaçan boşlukları en iyi deneme gösterir.',
    buddy: 'sondakika',
    colors: ['#f5a524', '#1b2250'],
  },
}

export const TYPE_ORDER: TypeId[] = ['ajanda', 'sondakika', 'gecekusu', 'kasif', 'anlatici', 'fosforlu', 'avci', 'maratoncu']

/**
 * Each question is centred on its own average: options lean one way more often on some axes (more
 * "with friends" answers than "alone" ones), and without centring a random clicker would drift there.
 */
const MEANS: Vector[] = QUESTIONS.map((q) => {
  const mean = { ...ZERO }
  for (const axis of Object.keys(ZERO) as Axis[]) mean[axis] = q.options.reduce((sum, o) => sum + (o.delta[axis] ?? 0), 0) / q.options.length
  return mean
})

/** How far each axis can move from the middle with these questions, to scale scores to −1..1. */
const RANGE: Vector = (() => {
  const max = { ...ZERO }
  QUESTIONS.forEach((q, i) => {
    for (const axis of Object.keys(ZERO) as Axis[]) {
      max[axis] += Math.max(...q.options.map((o) => Math.abs((o.delta[axis] ?? 0) - MEANS[i][axis])))
    }
  })
  return max
})()

/** The student's position on each axis, −1..1, from their answer indexes. */
export function profileOf(answers: number[]): Vector {
  const raw = { ...ZERO }
  answers.forEach((choice, i) => {
    const option = QUESTIONS[i]?.options[choice]
    if (!option) return
    for (const axis of Object.keys(ZERO) as Axis[]) raw[axis] += (option.delta[axis] ?? 0) - MEANS[i][axis]
  })
  const out = { ...ZERO }
  for (const axis of Object.keys(ZERO) as Axis[]) {
    // Scaled so that about half the possible movement already counts as a strong lean.
    out[axis] = Math.max(-1, Math.min(1, (raw[axis] / (RANGE[axis] || 1)) * 2))
  }
  return out
}

/** How much each axis counts. Rhythm (night/morning) is real but says less about how someone studies. */
const WEIGHTS: Vector = { plan: 1, depth: 1, social: 1, night: 0.85, style: 0.75 }

const AXES = Object.keys(ZERO) as Axis[]
const norm = (v: Vector) => Math.sqrt(AXES.reduce((sum, a) => sum + WEIGHTS[a] * v[a] ** 2, 0)) || 1

/**
 * Fit of a profile to a type: how far the student goes in that type's direction (a projection),
 * minus a small penalty for leaning the other way on axes the type does not care about. A plain
 * distance would let the most "average" type win every undecided student.
 */
function fit(profile: Vector, type: Vector): number {
  const n = norm(type)
  let along = 0
  for (const a of AXES) along += (WEIGHTS[a] * profile[a] * type[a]) / n
  const off = Math.sqrt(Math.max(0, norm(profile) ** 2 - along ** 2))
  return along - 0.25 * off
}

export interface QuizResult {
  type: StudentType
  runnerUp: StudentType
  /** 0-100, how well each type fits, best first. */
  matches: Array<{ type: StudentType; percent: number }>
  profile: Vector
}

export function resultOf(answers: number[]): QuizResult {
  const profile = profileOf(answers)
  const scored = TYPE_ORDER.map((id) => ({ type: TYPES[id], f: fit(profile, TYPES[id].profile) })).sort((a, b) => b.f - a.f)
  const top = scored[0].f
  const bottom = scored[scored.length - 1].f
  // Shown as a match percentage: the best type lands around 80-97%, the least fitting around 20%.
  const matches = scored.map(({ type, f }) => ({ type, percent: Math.round(20 + ((f - bottom) / (top - bottom || 1)) * (60 + Math.min(17, Math.max(0, top) * 12))) }))
  return { type: matches[0].type, runnerUp: matches[1].type, matches, profile }
}

/** Axis bars for the card: the side the student leans to and how strongly (50-100%). */
export const AXIS_LABELS: Array<{ axis: Exclude<Axis, 'style'>; plus: string; minus: string }> = [
  { axis: 'plan', plus: 'Planlı', minus: 'Akışına' },
  { axis: 'depth', plus: 'Anlamaya odaklı', minus: 'Sonuca odaklı' },
  { axis: 'social', plus: 'Grupla', minus: 'Yalnız' },
  { axis: 'night', plus: 'Gece kuşu', minus: 'Sabahçı' },
]

export function axisBars(profile: Vector): Array<{ label: string; percent: number; plus: boolean }> {
  return AXIS_LABELS.map(({ axis, plus, minus }) => {
    const value = profile[axis]
    return { label: value >= 0 ? plus : minus, percent: Math.round(50 + Math.abs(value) * 50), plus: value >= 0 }
  })
}

export const isTypeId = (value: unknown): value is TypeId => typeof value === 'string' && value in TYPES
