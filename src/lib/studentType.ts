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
 * Everyday situations for a playful student-type quiz, not a study-habits assessment.
 */
export const QUESTIONS: Question[] = [
  {
    id: 'haftasonu',
    text: () => "Arkadaşlarla buluşacaksınız. Grupta senin mesajın hangisi?",
    options: [
      { text: "Saatle yeri netleştirelim de ona göre çıkayım", delta: { plan: 2, social: -0.5 }, icon: 'calendar', react: "Konum, saat, tamam." },
      { text: "Siz çıkınca haber verin, hazırlanırım", delta: { plan: -2 }, icon: 'shuffle', react: "Hazırlanma süresi hesaba katılmadı." },
      { text: "Şu mekâna baktım da yorumları biraz karışık", delta: { depth: 1.5, social: -1 }, icon: 'search', react: "Mekânın geçmişi de incelenmiş." },
      { text: "Ben birkaç kişiye daha yazdım, onlar da geliyor", delta: { social: 2 }, icon: 'chat', react: "Buluşma biraz büyüdü." },
    ],
  },
  {
    id: 'alarm',
    text: () => "Yarın erken kalkman gerekiyor. Gece 00.30. Ne durumdasın?",
    options: [
      { text: "Telefonu bıraktım, sabah uğraşamam", delta: { night: -2 }, icon: 'sunrise', react: "Sabahki kendini düşündün." },
      { text: "Arkadaşla konuşuyorum; birazdan iyi geceler derim", delta: { night: -0.5, social: 1 }, icon: 'coffee', react: "Sohbetin bitiş saati belli olmuyor." },
      { text: "Yatacağım ama önce şu videoyu bitireyim", delta: { night: 1 }, icon: 'snooze', react: "O video da tam burada bitmiyordu." },
      { text: "Bütün gün uykum vardı, şimdi birden açıldım", delta: { night: 1.5, plan: -1 }, icon: 'moon', react: "Uyku zamanlaması yine şaştı." },
    ],
  },
  {
    id: 'dizi',
    text: () => "Biri sana çok iyi bir dizi önerdi. İlk hareket?",
    options: [
      { text: "Konusuna bakarken yorumlara, oradan oyunculara daldım", delta: { depth: 2, social: -1 }, icon: 'theory', react: "Dizi daha açılmadı, araştırma başladı." },
      { text: "Kaç bölüm? Bölümler kaç dakika?", delta: { depth: -2 }, icon: 'fastforward', react: "Takvime sığacak mı önce ona bakalım." },
      { text: "İzleyen birini bulup biraz anlattırırım", delta: { social: 1.5, depth: 0.5 }, icon: 'ask', react: "Spoiler vermeden anlatabilirse tabii." },
      { text: "Bir bölüm açarım; kendim bakayım", delta: { social: -0.5 }, icon: 'headphones', react: "Kararı ilk bölüm versin." },
    ],
  },
  {
    id: 'anaekran',
    text: () => "Galerinden bir şey göstereceksin. Telefonu açınca…",
    options: [
      { text: "Albümden bulurum; fotoğrafları arada ayırıyorum", delta: { style: 2, plan: 0.5 }, icon: 'palette', react: "Albüm isimleri işe yaradı." },
      { text: "Biraz kaydırmam lazım. Yok, biraz daha", delta: { plan: -1, style: -0.5 }, icon: 'bell', react: "O kadar yukarıda mı kalmış?" },
      { text: "Favorilere eklemiştim; iki dokunuş", delta: { depth: -1.5, style: -1 }, icon: 'minimal', react: "Sonraki kendine küçük bir iyilik." },
      { text: "Ekran görüntülerine bakıyorum; her şeyin bir kaydı var", delta: { depth: 1.5, plan: 0.5 }, icon: 'folders', react: "Galeride küçük bir arşiv var." },
    ],
  },
  {
    id: 'kafe',
    text: () => "Son anda buluşma iptal oldu. Boş kalan akşam?",
    options: [
      { text: "Evde yapacaklarım vardı zaten, onlara geçerim", delta: { plan: 1.5, social: -0.5 }, icon: 'lamp', react: "Akşamın yedek planı varmış." },
      { text: "Daha iyi, şimdi karar verebilirim", delta: { plan: -1.5 }, icon: 'swap', react: "Boşluk da bir seçenek." },
      { text: "Başka biri müsait mi diye bakarım", delta: { social: 2 }, icon: 'users', react: "Bir kapı kapandı, grup açıldı." },
      { text: "Kulaklığı takıp kendi hâlime kalırım; gece de uzayabilir", delta: { night: 1, social: -1 }, icon: 'window', react: "Bu akşam biraz kendine kaldı." },
    ],
  },
  {
    id: 'grup',
    text: () => "Gruba baktın, 47 mesaj birikmiş. Genelde sen?",
    options: [
      { text: "Okuyup bir sesli mesajla hepsine cevap veririm", delta: { social: 2, depth: 1 }, icon: 'mic', react: "Konular topluca yanıtlandı." },
      { text: "Okurum, yazacak bir şeyim varsa yazarım", delta: { social: -2 }, icon: 'ghost', react: "Okumak da katılmanın bir yolu." },
      { text: "Son kararı sorarım: şimdi ne yapıyoruz?", delta: { social: 0.5, depth: -1 }, icon: 'clock', react: "Önce neticeyi öğrenelim." },
      { text: "Mesaj birikmeden bakmışımdır; bildirim pek bekleyemiyor", delta: { social: -1.5, plan: 0.5, night: -0.5 }, icon: 'early', react: "47 olmadan yakalandı." },
    ],
  },
  {
    id: 'sabah',
    text: (w) => `${cap(w.exam)} sabahı evden çıkıyorsun. Son durum?`,
    options: [
      { text: "Kalem, kimlik tamam. Bir şey unuttum mu diye yine bakıyorum", delta: { plan: 1.5, night: -0.5 }, icon: 'bed', react: "Kontrolün kontrolü." },
      { text: "Daha süre var diye diye son anda çıkıyorum", delta: { plan: -2, night: 1.5 }, icon: 'zap', react: "O son on dakika nereye gidiyor?" },
      { text: "Kapının önünde birileriyle son kez konuşuyorum", delta: { social: 1.5 }, icon: 'bus', react: "Herkeste başka bir söylenti var." },
      { text: "Şu hep çıkan soruya bir kez daha bakıyorum", delta: { depth: -1.5, plan: 0.5 }, icon: 'target', react: "Bir kez daha bakmak içini rahatlatıyor." },
    ],
  },
  {
    id: 'oyun',
    text: () => "İlk kez bir yemek yapacaksın. Tarif önünde. Sen?",
    options: [
      { text: "Yorumlara da bakarım; niye tutmamış, neyi değiştirmişler", delta: { depth: 2, social: -0.5 }, icon: 'gear', react: "Tarifin yorumları ikinci bir tarif." },
      { text: "Malzeme listesini gördüm, gerisini yaparken okurum", delta: { depth: -1.5 }, icon: 'play', react: "Sonraki adım pişirirken öğrenilecek." },
      { text: "Bilen birini ararım: bu kıvam normal mi?", delta: { social: 1.5, depth: 0.5 }, icon: 'friends', react: "Kıvamı telefonda tarif etmek kolay değil." },
      { text: "Tarifi görebileceğim şekilde açar, malzemeleri dizerim", delta: { style: 1.5, depth: -1 }, icon: 'brush', react: "Mutfak şimdilik düzenli." },
    ],
  },
  {
    id: 'yilbasi',
    text: () => "Bir şey alacaksın ama hemen şart değil. Hangisi sana yakın?",
    options: [
      { text: "Listeye eklerim; fiyatına sonra tekrar bakarım", delta: { plan: 1.5, style: 0.5 }, icon: 'list', react: "Sepet biraz bekleyebilir." },
      { text: "İnceleme izlerken ürün hakkında gereğinden çok şey öğrendim", delta: { depth: 2 }, icon: 'book', react: "Artık başkasına da önerirsin." },
      { text: "İşimi göreni buldum, daha fazla bakmayacağım", delta: { depth: -2, plan: 0.5 }, icon: 'scale', react: "Karar verildi, sekmeler kapanabilir." },
      { text: "Bakarken başka bir şey gördüm; şu an onu inceliyorum", delta: { plan: -2 }, icon: 'wave', react: "İlk baktığın şey biraz geride kaldı." },
    ],
  },
  {
    id: 'bolum',
    text: () => "Bölüm bitti. Ekranda “Sonraki bölüm” geri sayıyor.",
    options: [
      { text: "Kapatırım; yarınki işim aklıma geldi", delta: { plan: 2 }, icon: 'stop', react: "Yarınki sen memnun." },
      { text: "Bir tane daha derim. Sonra gerçekten bir tane daha", delta: { plan: -2, night: 1 }, icon: 'tv', react: "O tuşun bekleme süresi fazla kısa." },
      { text: "İzleyen arkadaşa yazarım: o son neydi öyle?", delta: { social: 1.5 }, icon: 'send', react: "O sahne konuşulmadan kalmaz." },
      { text: "Ev sessizleşmiş, kimse bölmüyor; devam ederim", delta: { night: 1, social: -1.5 }, icon: 'walk', react: "Tam rahat rahat izlenecek zaman." },
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
    name: "Planı Olan Arkadaş",
    tagline: "“Bir netleştirelim de…”",
    you: ["Buluşmanın saati belli olmadan hazırlanmaya başlayamıyorsun.","Bir işi bitirip listeden silmek, işin kendisinden biraz daha güzel.","Son dakika değişikliğine önce bir iç çekiyorsun."],
    profile: { plan: 1, depth: 0.3, social: 0.15, night: 0, style: 0.25 },
    description: "Herkes “bakarız” derken sen en azından neye bakacağınızı bilmek istiyorsun. Grupta saat ve konumu soran kişi olman tesadüf değil. Bazen plan yaptın diye işin yarısı bitmiş gibi geliyor; kalan yarısı hâlâ masada tabii.",
    strengths: ["Ortada olmayan planı bir şekilde ortaya çıkarmak","Karmaşık bir işi küçük parçalara ayırmak"],
    blindSpot: "Plan aksayınca hevesin de yanında gidebiliyor. Bazen sadece saat değişti; bütün gün iptal olmadı.",
    tactic: "Planına boşluk da bırak. “Buraya kadar yeter” yazmak da plan sayılır.",
    buddy: 'kasif',
    colors: ['#7aa7ff', '#1b2250'],
  },
  sondakika: {
    id: 'sondakika',
    name: "Son Dakikacı",
    tagline: "Daha var. Daha var. Nasıl kalmadı?",
    you: ["Hazırlanmak için ayırdığın sürenin bir kısmını süreye bakarak geçiriyorsun.","“Daha erken” ile “geç kaldım” arasında bir saat dilimi eksik.","Bir işi gönderince ilk düşündüğün şey: bunu niye daha önce yapmadım?"],
    profile: { plan: -1, depth: -0.5, social: 0, night: 0.7, style: -0.2 },
    description: "Başlamak için doğru anı beklerken işin teslim saati gelmiş olabiliyor. Ama bir kere oturunca bir süredir yapamadığın şeyi peş peşe hallediyorsun. Dışarıdan rahat görünüyorsun; içeride açık kalan birkaç sekme var.",
    strengths: ["Az zaman kalınca neyi önce yapacağını seçmek","İşe girdikten sonra hız kazanmak"],
    blindSpot: "Sonunda yetişse bile o aradaki gerilim yoruyor. “Böyle daha iyi çalışıyorum” kısmı bazen biraz mecburiyetten.",
    tactic: "Bir dahaki sefere “bitireceğim” diye değil, “bir açıp bakacağım” diye otur. Açınca bazen devamı geliyor.",
    buddy: 'ajanda',
    colors: ['#ff8a5c', '#1b2250'],
  },
  gecekusu: {
    id: 'gecekusu',
    name: "Gececi",
    tagline: "Gün bitti. Sen yeni açıldın.",
    you: ["Gündüz uykun varken gece birden yapacak şey buluyorsun.","“Şunu da halledeyim” dediğin saatler biraz geç.","Ev sessizken her şey daha kolaymış gibi geliyor."],
    profile: { plan: -0.2, depth: 0.7, social: -0.7, night: 1, style: 0 },
    description: "Bütün gün bölük pörçük geçen dikkat, herkes kendi köşesine çekilince toparlanıyor. Bir şey okuyorsun, bir video açıyorsun, derken saate bakıyorsun. “Geç olmuş” diye fark ettiğin an genelde ilk fark ettiğin an değil.",
    strengths: ["Sessiz bir ortam bulunca bir şeye dalabilmek","Tek başına vakit geçirmekten sıkılmamak"],
    blindSpot: "Geceki sen ile sabahki sen bazen birbirinden habersiz kararlar alıyor. Alarmı kuranla kapatan aynı kişi gibi değil.",
    tactic: "Geceki kendinden sabahki kendine biraz insaf iste. Her yarım kalan şey bu gece bitmek zorunda değil.",
    buddy: 'maratoncu',
    colors: ['#8b7cf6', '#ffe14d'],
  },
  kasif: {
    id: 'kasif',
    name: "Bir Sekme Daha",
    tagline: "Bir şeye bakacaktın. Konu nerelere geldi.",
    you: ["Kısa bir sorunun cevabı bazen uzun bir araştırmaya dönüşüyor.","Bir şey önerilince önerinin kendisi kadar arka planını da merak ediyorsun.","Ne zaman öğrendiğini hatırlamadığın, gereksiz ama ilginç bilgiler biliyorsun."],
    profile: { plan: -0.5, depth: 1, social: -0.1, night: 0.2, style: 0 },
    description: "Bir şeyi anlamayınca “öyledir herhâlde” deyip geçmek kolay gelmiyor. Açıklamaya bakıyorsun, orada geçen başka bir şeyi aratıyorsun. Başlangıçtaki soruya dönene kadar konu biraz genişlemiş oluyor.",
    strengths: ["Başkalarının geçip gittiği bir ayrıntıyı fark etmek","Bir konuyu başka bir şeye bağlayabilmek"],
    blindSpot: "Merak ettiğin şeyin sonu var da bakacaklarının sonu yok. İlk açtığın sekme bazen seni bekliyor.",
    tactic: "Aklına takılan yan konuyu bir yere yaz. Kaçmıyor; elindeki işten sonra da orada olacak.",
    buddy: 'avci',
    colors: ['#3ccf91', '#1b2250'],
  },
  anlatici: {
    id: 'anlatici',
    name: "Birine Anlatmam Lazım",
    tagline: "“Bak şimdi, olay şu…”",
    you: ["Bir dizi bitince izleyen birini bulmak istiyorsun.","Bir şeyi anlatırken aslında ne düşündüğün daha netleşiyor.","“Kısaca anlatayım” dedikten sonra süre biraz uzayabiliyor."],
    profile: { plan: 0.2, depth: 0.5, social: 1, night: -0.2, style: 0 },
    description: "Bir şeyleri tek başına düşünüp orada bırakmak yerine birine açmayı seviyorsun. Bazen fikir almak, bazen birlikte gülmek için. Konuşurken konu da şekilleniyor; bir bakmışsın sen de az önce ne düşündüğünü daha iyi anlamışsın.",
    strengths: ["Bir konuşmayı başlatıp sürdürmek","Soruyu başka türlü sorunca meseleyi açmak"],
    blindSpot: "“Biraz konuşalım, sonra başlarız” kısmı bazen planlanandan uzun. İkiniz de iyi vakit geçirdiniz ama iş hâlâ duruyor.",
    tactic: "Bir arkadaşına konuyu anlat, sonra onun sana bir soru sormasını iste. O soru bazen bütün meseleyi açıyor.",
    buddy: 'gecekusu',
    colors: ['#ff6fb5', '#1b2250'],
  },
  fosforlu: {
    id: 'fosforlu',
    name: "Önce Bir Toparlayayım",
    tagline: "Başlamadan önce şurası bir düzelsin.",
    you: ["Aradığın şeyi bulabilmek için az da olsa bir düzen istiyorsun.","Yeni bir defterin ilk sayfasına biraz daha dikkatli yazıyorsun.","Bazen hazırlanma kısmı asıl işten daha uzun sürüyor."],
    profile: { plan: 0.3, depth: -0.2, social: -0.1, night: 0, style: 1 },
    description: "İşin bir yerine düzen getirmek sana başlamışsın hissi veriyor. Başlıkları ayırmak, malzemeleri dizmek, ekrandaki fazlalıkları kapatmak… Sonra bir bakıyorsun ortam hazır; şimdi sıra işin kendisinde.",
    strengths: ["Dağınık bir şeyi bakılabilir hâle getirmek","Sonra geri döneceğin yeri düşünmek"],
    blindSpot: "Bir düzenleme daha yapınca başlayacakmışsın gibi geliyor. Ama o son düzenleme bazen bitmiyor.",
    tactic: "Bir gün de biraz dağınık başlayıver. İlk sayfanın güzel olmasıyla işin bitmesi aynı şey değil.",
    buddy: 'anlatici',
    colors: ['#ffe14d', '#1b2250'],
  },
  avci: {
    id: 'avci',
    name: "Gereken Kadar",
    tagline: "“Tamam da bana hangisi lazım?”",
    you: ["Bir şeyi almadan veya yapmadan önce işine yarayıp yaramayacağına bakıyorsun.","Cevabı bulunca diğer sekmeleri kapatabiliyorsun.","Uzun bir anlatımda sonuç kısmına biraz erken geçmek istiyorsun."],
    profile: { plan: 0.4, depth: -1, social: 0, night: -0.2, style: -0.3 },
    description: "Sen önce işin senden ne istediğini anlamaya çalışıyorsun. Her ayrıntıya aynı zamanı ayırmak istemiyorsun; işe yarayan yolu bulunca oradan ilerliyorsun. Bazen arkadaşın hâlâ seçenekleri anlatırken sen kararını vermiş oluyorsun.",
    strengths: ["Bir sürü seçenek arasından iş göreni seçmek","Neye vakit ayıracağına karar vermek"],
    blindSpot: "Kestirme yol tanıdıkken güzel. Soru biraz değişince atladığın ayrıntı geri gelebiliyor.",
    tactic: "Bir şey kolay geldiyse kendine bir kez “neden?” diye sor. Uzun uzun değil; cevabını verecek kadar.",
    buddy: 'kasif',
    colors: ['#4fd1e8', '#1b2250'],
  },
  maratoncu: {
    id: 'maratoncu',
    name: "Sessizce Halleden",
    tagline: "Sen ne ara bitirdin?",
    you: ["Bir işi yaptığını herkese söyleme ihtiyacı duymuyorsun.","Ortalık telaşlıyken kendi köşende ilerlemek daha kolay geliyor.","Yarım kalan bir şeye sonra dönmek, tek seferde tüketmekten daha normal geliyor."],
    profile: { plan: 0.35, depth: 0.35, social: -0.8, night: -1, style: 0 },
    description: "Grupta en çok ses çıkaran kişi olmayabilirsin ama bu, geride kaldığın anlamına gelmiyor. Biraz yapıp bırakıyor, sonra yeniden dönüyorsun. İnsanlar ancak bitirdiğini duyunca ne zamandır uğraştığını fark edebiliyor.",
    strengths: ["Bir işi gösterişsizce sürdürebilmek","Kendi başına vakit geçirip ilerlemek"],
    blindSpot: "Kendi kendine giderken bazen “ben bunu doğru mu anladım?” diye soracak biri eksik kalıyor.",
    tactic: "Ara sıra yaptığını birine göster. Büyük bir değerlendirme gerekmiyor; “şuna bir bakar mısın?” yeter.",
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
