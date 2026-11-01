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
 * Questions about recent study situations. Wording stays tentative: these are preferences, not fixed personality traits.
 */
export const QUESTIONS: Question[] = [
  {
    id: 'haftasonu',
    text: () => "Önünde birkaç konu birikti. Çalışmaya nereden başlarsın?",
    options: [
      { text: "Önce hangisini ne zaman çalışacağımı kabaca yazarım", delta: { plan: 2, social: -0.5 }, icon: 'calendar', react: "Önce biraz netlik." },
      { text: "Birini açarım; başlayınca gerisi biraz şekillenir", delta: { plan: -2 }, icon: 'shuffle', react: "Başlamak da bir yöntem." },
      { text: "En çok kafama takılan konuyu açarım", delta: { depth: 1.5, social: -1 }, icon: 'search', react: "Aklında kalan yerden." },
      { text: "Birine sorarım: sen nereden başladın?", delta: { social: 2 }, icon: 'chat', react: "Birlikte karar vermek kolaylaştırabiliyor." },
    ],
  },
  {
    id: 'alarm',
    text: () => "Çalışmak için günün hangi kısmını ayırmak daha kolay geliyor?",
    options: [
      { text: "Sabah; gün karışmadan biraz ilerlemek iyi geliyor", delta: { night: -2 }, icon: 'sunrise', react: "Günün başında biraz alan." },
      { text: "Gündüz, biriyle sözleşince oturmak daha kolay", delta: { night: -0.5, social: 1 }, icon: 'coffee', react: "Birlikte oturmak başlangıcı kolaylaştırıyor." },
      { text: "Akşam; günün işleri bitince toparlanıyorum", delta: { night: 1 }, icon: 'snooze', react: "Önce günün telaşı geçsin." },
      { text: "Geç saatler; ortam sessizleşince başlayabiliyorum", delta: { night: 1.5, plan: -1 }, icon: 'moon', react: "Sessizlik iyi gelebiliyor." },
    ],
  },
  {
    id: 'dizi',
    text: () => "Aynı paragrafı üçüncü kez okudun, hâlâ oturmadı. Sonra?",
    options: [
      { text: "Önceki konuya dönerim; bir yerde bağlantı kaçtı galiba", delta: { depth: 2, social: -1 }, icon: 'theory', react: "Bazen eksik parça önceki sayfada." },
      { text: "Çözülmüş bir örneğe bakarım; ne yapıldığını göreyim", delta: { depth: -2 }, icon: 'fastforward', react: "Bir örnek işleri açabiliyor." },
      { text: "Birine sorarım; başka türlü anlatılınca anlaşılabiliyor", delta: { social: 1.5, depth: 0.5 }, icon: 'ask', react: "Farklı bir anlatım işe yarayabiliyor." },
      { text: "Biraz kendim uğraşırım; bölünmeden düşünmem lazım", delta: { social: -0.5 }, icon: 'headphones', react: "Biraz düşünme payı." },
    ],
  },
  {
    id: 'anaekran',
    text: () => "Bir hafta sonra kendi notunu açtın. Genelde ne görüyorsun?",
    options: [
      { text: "Başlıkları ve önemli yerleri ayırmışım; bulması kolay", delta: { style: 2, plan: 0.5 }, icon: 'palette', react: "Aradığını bulmak rahatlatıyor." },
      { text: "Biraz her yere yazmışım; nerede ne var az çok biliyorum", delta: { plan: -1, style: -0.5 }, icon: 'bell', react: "Not alırken her şey sırayla gitmiyor." },
      { text: "İşime yarayacak birkaç kısa madde veya soru", delta: { depth: -1.5, style: -1 }, icon: 'minimal', react: "Geri döneceğin kadar not." },
      { text: "Konu konu ayırmışım; aralarındaki bağlantıları da yazmışım", delta: { depth: 1.5, plan: 0.5 }, icon: 'folders', react: "Konuların birbirine bağlandığı yerler." },
    ],
  },
  {
    id: 'kafe',
    text: () => "Çalışmaya ayırdığın boş bir saat çıktı. Ne yaparsın?",
    options: [
      { text: "Böldürmeyecek bir yer bulup küçük bir hedef koyarım", delta: { plan: 1.5, social: -0.5 }, icon: 'lamp', react: "Bir saatlik alan açıldı." },
      { text: "O an neye yetişmem gerekiyorsa ona bakarım", delta: { plan: -1.5 }, icon: 'swap', react: "O günün ihtiyacına göre." },
      { text: "Bir arkadaşla aynı yere geçerim; oturmak kolaylaşır", delta: { social: 2 }, icon: 'users', react: "Aynı masada olmak yetebiliyor." },
      { text: "Mümkünse sessiz bir yere çekilirim, özellikle akşamsa", delta: { night: 1, social: -1 }, icon: 'window', react: "Biraz sessizlik, biraz alan." },
    ],
  },
  {
    id: 'grup',
    text: () => "Bir konuyu anladın mı diye kontrol etmek istiyorsun. Nasıl denersin?",
    options: [
      { text: "Birine anlatırım; anlatırken nerede takıldığım çıkıyor", delta: { social: 2, depth: 1 }, icon: 'mic', react: "Anlatırken eksikler görünür olabiliyor." },
      { text: "Tek başıma, notu kapatıp hatırlamayı denerim", delta: { social: -2 }, icon: 'ghost', react: "Kaynağı kapatınca daha net anlaşılıyor." },
      { text: "Arkadaşla birbirimize kısa sorular sorarız", delta: { social: 0.5, depth: -1 }, icon: 'clock', react: "Soru sormak da çalışmanın parçası." },
      { text: "Önceden ayırdığım zamanda kendi kendime birkaç soru çözerim", delta: { social: -1.5, plan: 0.5, night: -0.5 }, icon: 'early', react: "Küçük bir kontrol molası." },
    ],
  },
  {
    id: 'sabah',
    text: (w) => `${cap(w.exam)} sabahı. Sana en yakın olan hangisi?`,
    options: [
      { text: "Hazırladığım kısa notlara bakıp bırakmaya çalışıyorum", delta: { plan: 1.5, night: -0.5 }, icon: 'bed', react: "Son bir bakış." },
      { text: "Keşke önce baksaydım dediğim birkaç yer hâlâ var", delta: { plan: -2, night: 1.5 }, icon: 'zap', react: "Yetişmeyen yerler olabiliyor." },
      { text: "Bir arkadaşla birbirimize son birkaç soru soruyoruz", delta: { social: 1.5 }, icon: 'bus', react: "Birlikte son kontrol." },
      { text: "Örnek sorulara bakıp hangi adımları izleyeceğimi hatırlıyorum", delta: { depth: -1.5, plan: 0.5 }, icon: 'target', react: "Çözüm yolunu hatırlamak için." },
    ],
  },
  {
    id: 'oyun',
    text: () => "Yeni bir konuyu açtın. İlk ne görmek istersin?",
    options: [
      { text: "Neden öyle olduğunu anlatan bir açıklama", delta: { depth: 2, social: -0.5 }, icon: 'gear', react: "Mantığı bulunca devamı geliyor." },
      { text: "Baştan sona çözülmüş bir soru", delta: { depth: -1.5 }, icon: 'play', react: "Önce nasıl kullanıldığına bakmak." },
      { text: "Birinin kendi cümleleriyle anlatmasını", delta: { social: 1.5, depth: 0.5 }, icon: 'friends', react: "Başka birinin anlatımıyla başlamak." },
      { text: "Konuyu tek sayfada toparlayan bir şema veya not", delta: { style: 1.5, depth: -1 }, icon: 'brush', react: "Önce bütünü görmek." },
    ],
  },
  {
    id: 'yilbasi',
    text: () => "Bu haftaki çalışmanın sonunda ne olmuş olsa içim rahat derdin?",
    options: [
      { text: "Ayırdığım konuları bitirmiş, eksiklerimi görmüş olayım", delta: { plan: 1.5, style: 0.5 }, icon: 'list', react: "Biraz ilerleme, biraz netlik." },
      { text: "Bir türlü oturmayan konunun mantığını anlayayım", delta: { depth: 2 }, icon: 'book', react: "Aklına takılan yer çözülsün." },
      { text: "Önümdeki sınav veya iş için gereken kısmı halledeyim", delta: { depth: -2, plan: 0.5 }, icon: 'scale', react: "Şu anki ihtiyacı karşılasın." },
      { text: "Çok plan yapmadan da olsa bir yerinden ilerleyeyim", delta: { plan: -2 }, icon: 'wave', react: "Küçük bir ilerleme de sayılır." },
    ],
  },
  {
    id: 'bolum',
    text: () => "Ayırdığın çalışma süresi bitti ama konu yarım. Genelde?",
    options: [
      { text: "Nerede kaldığımı yazıp bırakırım; sonra devam ederim", delta: { plan: 2 }, icon: 'stop', react: "Sonraki başlangıcı kolaylaştırmak." },
      { text: "Biraz daha derken planladığımdan uzun kalırım", delta: { plan: -2, night: 1 }, icon: 'tv', react: "Bırakılacak yeri bulmak her zaman kolay değil." },
      { text: "Birine takıldığım yeri sorup öyle kapatırım", delta: { social: 1.5 }, icon: 'send', react: "Soruyla kapatmak da bir seçenek." },
      { text: "Ortalık sessizse devam ederim; tam şimdi toparlanmışken", delta: { night: 1, social: -1.5 }, icon: 'walk', react: "Odağı bulunca bırakmak zor gelebiliyor." },
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
    name: "Önce Bir Plan",
    tagline: "Nereden başlayacağını bilince biraz rahatlıyorsun.",
    you: ["Çalışmadan önce konuları küçük parçalara ayırmak iyi geliyor.","Bitirdiğin şeyi işaretlemek devam etmeni kolaylaştırıyor.","Planın bazen çalışmaktan daha uzun sürüyor; farkındasın."],
    profile: { plan: 1, depth: 0.3, social: 0.15, night: 0, style: 0.25 },
    description: "Bu aralar belirsizliği azaltarak çalışmaya daha yakınsın. Her dakikayı planlamak zorunda değilsin; önünde ne olduğunu görmek bile başlamanı kolaylaştırabilir.",
    strengths: ["Büyük bir işi yapılabilir parçalara ayırmak","Eksik kalan konuları takip etmek"],
    blindSpot: "Bir gün aksayınca bütün plan bozulmuş gibi gelebilir. Oysa ertesi gün küçük bir yerden devam etmek de mümkün.",
    tactic: "Bir sonraki oturum için tek bir küçük hedef yaz. Planda boşluk da bırak; her gün aynı geçmiyor.",
    buddy: 'kasif',
    colors: ['#7aa7ff', '#1b2250'],
  },
  sondakika: {
    id: 'sondakika',
    name: "Son Düzlükte Açılan",
    tagline: "Başlamak zor, az zaman kalınca odak geliyor.",
    you: ["Başlamadan önce iş, olduğundan büyük görünebiliyor.","Süre azalınca neyi çalışman gerektiği birden netleşiyor.","Biraz önce başlasaydım daha rahat olurdu dediğin oluyor."],
    profile: { plan: -1, depth: -0.5, social: 0, night: 0.7, style: -0.2 },
    description: "Cevapların, yaklaşan bir tarih olduğunda harekete geçmenin kolaylaştığını düşündürüyor. Bu her şeyi son geceye bıraktığın anlamına gelmiyor; bazen başlamak için daha somut bir hedef gerekiyor.",
    strengths: ["Kısıtlı zamanda öncelik seçebilmek","Hedef netleşince işe odaklanmak"],
    blindSpot: "Süre daralınca dinlenmek ve anlamadığın yere dönmek için az alan kalabilir.",
    tactic: "Bütün konuyu bitirmeyi değil, bir soruya 10 dakika bakmayı hedefle. Sonra devam edip etmeyeceğine karar ver.",
    buddy: 'ajanda',
    colors: ['#ff8a5c', '#1b2250'],
  },
  gecekusu: {
    id: 'gecekusu',
    name: "Ortalık Sessizleşince",
    tagline: "Gün sakinleşince kafanda da yer açılıyor.",
    you: ["Gündüz bölündüğün bir konuya akşam daha rahat dönebiliyorsun.","Çalışırken biraz yalnız kalmak iyi gelebiliyor.","Odak geldiğinde saatin ilerlediğini fark etmediğin oluyor."],
    profile: { plan: -0.2, depth: 0.7, social: -0.7, night: 1, style: 0 },
    description: "Şu sıralar sakin bir ortam ve kesintisiz zaman senin için öne çıkıyor. Bunun her zaman gece olması gerekmiyor; asıl iyi gelen, bir süre kimseye yetişmek zorunda olmamak olabilir.",
    strengths: ["Bir konuya bölünmeden zaman ayırmak","Kendi hızında düşünmek"],
    blindSpot: "Odak geldi diye uykudan sürekli kısmak, ertesi gün çalışmayı zorlaştırabilir.",
    tactic: "Sessiz bir çalışma aralığı seç ve yaklaşık bitiş saatini baştan belirle. Yarın nereden devam edeceğini bir cümleyle not et.",
    buddy: 'maratoncu',
    colors: ['#8b7cf6', '#ffe14d'],
  },
  kasif: {
    id: 'kasif',
    name: "Bir Şey Takıldı Aklıma",
    tagline: "Anlamadan geçince konu aklında kalıyor.",
    you: ["Bir açıklamada eksik bir bağlantı hissedince geri dönüyorsun.","Bir sorunun neden öyle çözüldüğünü merak ediyorsun.","Bazen tek bir ayrıntıya ayırdığın süre uzuyor."],
    profile: { plan: -0.5, depth: 1, social: -0.1, night: 0.2, style: 0 },
    description: "Cevaplarında konunun mantığını bulma isteği öne çıkıyor. Her derse aynı merakı duyman gerekmiyor; ama bir şey kafana takıldı mı yalnızca cevabı görmek yetmeyebiliyor.",
    strengths: ["Konular arasındaki bağlantıları aramak","Anlamadığın yeri fark edip soru sormak"],
    blindSpot: "Tek bir ayrıntıyla uğraşırken bakman gereken diğer konular bekleyebilir.",
    tactic: "Merak ettiğin yan soruları ayrı bir yere yaz. Önce elindeki hedefi tamamla, sonra içlerinden birine dön.",
    buddy: 'avci',
    colors: ['#3ccf91', '#1b2250'],
  },
  anlatici: {
    id: 'anlatici',
    name: "Birlikte Daha İyi",
    tagline: "Birine anlatınca konu biraz daha oturuyor.",
    you: ["Kendi cümlelerinle anlatırken nerede takıldığını fark ediyorsun.","Birinin sorduğu soru, senin de atladığın yeri gösterebiliyor.","Aynı masaya oturmak bazen başlamanı kolaylaştırıyor."],
    profile: { plan: 0.2, depth: 0.5, social: 1, night: -0.2, style: 0 },
    description: "Bu aralar konuşarak, sorarak veya biriyle aynı ortamda çalışarak ilerlemeye daha yakınsın. Bu, her grupta sözü alan kişi olduğun anlamına gelmiyor; bazen tek bir arkadaşla düşünmek yeterli.",
    strengths: ["Düşüncelerini anlatırken toparlamak","Farklı açıklamalardan yararlanmak"],
    blindSpot: "Birlikte oturmak bazen çalışmanın kendisinin yerine geçebilir; süre bitince ne yaptığınız belirsiz kalabilir.",
    tactic: "Başlamadan ikiniz de birer hedef söyleyin. Sonunda notlara bakmadan birbirinize kısa birer soru sorun.",
    buddy: 'gecekusu',
    colors: ['#ff6fb5', '#1b2250'],
  },
  fosforlu: {
    id: 'fosforlu',
    name: "Önce Bir Toparlayayım",
    tagline: "Konu gözünün önünde düzene girince rahatlıyorsun.",
    you: ["Karışık bir sayfadan çalışmak başlamanı zorlaştırabiliyor.","Bir şema veya kısa not bütünü görmene yardım ediyor.","Bazen notu toparlamaya ayırdığın süre uzuyor."],
    profile: { plan: 0.3, depth: -0.2, social: -0.1, night: 0, style: 1 },
    description: "Cevaplarında bilgiyi düzenleme ve bir arada görme ihtiyacı öne çıkıyor. Bunun renkli kalemlerle ilgisi olmak zorunda değil; temiz bir başlık listesi de aynı işi görebilir.",
    strengths: ["Bilgiyi daha kolay geri dönülecek hâle getirmek","Konunun genel yapısını görünür kılmak"],
    blindSpot: "Düzenli görünen bir sayfa, konuyu hatırlayabildiğin hissini verebilir. Bunu küçük bir soruyla kontrol etmek iyi gelir.",
    tactic: "Notu toparladıktan sonra sayfayı kapat. Aklında kalan üç şeyi yaz; sonra eksik kalan yerlere dön.",
    buddy: 'anlatici',
    colors: ['#ffe14d', '#1b2250'],
  },
  avci: {
    id: 'avci',
    name: "Önce Gerekeni Halledeyim",
    tagline: "Vaktini neye ayırdığın senin için önemli.",
    you: ["Çalışmadan önce senden ne beklendiğini görmek istiyorsun.","Bir örnek soru, nereden başlayacağını netleştiriyor.","Şu an işine yaramayan ayrıntıları sonraya bırakabiliyorsun."],
    profile: { plan: 0.4, depth: -1, social: 0, night: -0.2, style: -0.3 },
    description: "Bu aralar önündeki ihtiyaca göre çalışma eğilimin daha güçlü. Bazen anlamak istediğin her şeye zaman yetmiyor; sen de önce gereken kısmı seçmeye çalışıyorsun.",
    strengths: ["Öncelik belirlemek","Örneklerden yola çıkarak ilerlemek"],
    blindSpot: "Yalnızca tanıdık soru biçimlerine çalışınca aynı konunun başka türlü sorulması zorlayabilir.",
    tactic: "Çözdüğün bir soruda küçük bir şeyi değiştir: sayı, koşul veya örnek. Aynı yolu neden kullanıp kullanamayacağını düşün.",
    buddy: 'kasif',
    colors: ['#4fd1e8', '#1b2250'],
  },
  maratoncu: {
    id: 'maratoncu',
    name: "Az Az İlerleyen",
    tagline: "Tek seferde bitirmektense geri dönebilmek iyi geliyor.",
    you: ["Küçük bir parçayı halledince iş daha yapılabilir görünüyor.","Yarım bıraktığın yere nereden döneceğini bilmek istiyorsun.","Her gün aynı gitmese de bir düzen kurmaya çalışıyorsun."],
    profile: { plan: 0.35, depth: 0.35, social: -0.8, night: -1, style: 0 },
    description: "Cevapların, daha sakin ve tekrarlanabilir bir çalışma düzenine yakın duruyor. Bu hiç aksatmadığın anlamına gelmiyor; önemli olan, ara verdikten sonra da geri dönebileceğin bir yol bulmak.",
    strengths: ["Çalışmayı küçük oturumlara bölebilmek","Aynı konuya yeniden dönmek"],
    blindSpot: "Düzenli okumakla gerçekten hatırlayabilmek birbirine karışabilir. Ara sıra kendini yoklamak faydalı.",
    tactic: "Bir oturumun sonuna iki kısa soru ekle. Notu kapatıp cevapla; sonraki oturumda önce zorlandığın soruya dön.",
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
