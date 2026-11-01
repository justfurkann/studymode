/*
 * Universities in Türkiye (state and foundation) and the most popular ones in KKTC, for the
 * "Hangi öğrenci tipisin?" quiz. A fixed list: no network, works offline, nothing to keep running.
 * Short names students use ("ODTÜ", "İTÜ") are listed as aliases so search finds them. A school
 * that is missing can be typed in by hand. When YÖK adds or renames one, edit this list.
 */

export interface University {
  name: string
  /** Name to print on the result card. */
  short: string
  city: string
  aliases?: string[]
}

const U = (name: string, city: string, short?: string, aliases: string[] = []): University => ({ name, city, short: short ?? name.replace(/ Üniversitesi$/, ''), aliases })

export const UNIVERSITIES: University[] = [
  // İstanbul
  U('Boğaziçi Üniversitesi', 'İstanbul', 'Boğaziçi', ['boun', 'bogazici']),
  U('İstanbul Teknik Üniversitesi', 'İstanbul', 'İTÜ', ['itu']),
  U('İstanbul Üniversitesi', 'İstanbul', 'İstanbul Üniversitesi', ['iu']),
  U('İstanbul Üniversitesi-Cerrahpaşa', 'İstanbul', 'İÜC', ['cerrahpasa', 'iuc']),
  U('Yıldız Teknik Üniversitesi', 'İstanbul', 'YTÜ', ['ytu', 'yildiz']),
  U('Marmara Üniversitesi', 'İstanbul', 'Marmara'),
  U('Galatasaray Üniversitesi', 'İstanbul', 'Galatasaray', ['gsu']),
  U('Mimar Sinan Güzel Sanatlar Üniversitesi', 'İstanbul', 'MSGSÜ', ['msgsu', 'mimar sinan']),
  U('İstanbul Medeniyet Üniversitesi', 'İstanbul', 'Medeniyet'),
  U('Sağlık Bilimleri Üniversitesi', 'İstanbul', 'SBÜ', ['sbu']),
  U('Türk-Alman Üniversitesi', 'İstanbul', 'TAÜ', ['tau', 'turk alman']),
  U('Milli Savunma Üniversitesi', 'İstanbul', 'MSÜ', ['msu']),
  U('Koç Üniversitesi', 'İstanbul', 'Koç', ['ku', 'koc']),
  U('Sabancı Üniversitesi', 'İstanbul', 'Sabancı', ['sabanci', 'su']),
  U('Özyeğin Üniversitesi', 'İstanbul', 'Özyeğin', ['ozu']),
  U('Bilgi Üniversitesi', 'İstanbul', 'Bilgi', ['istanbul bilgi']),
  U('Bahçeşehir Üniversitesi', 'İstanbul', 'BAU', ['bau', 'bahcesehir']),
  U('Kadir Has Üniversitesi', 'İstanbul', 'Kadir Has', ['khas']),
  U('Yeditepe Üniversitesi', 'İstanbul', 'Yeditepe'),
  U('İstanbul Aydın Üniversitesi', 'İstanbul', 'Aydın Üniversitesi'),
  U('İstanbul Kültür Üniversitesi', 'İstanbul', 'İKÜ', ['iku']),
  U('İstanbul Ticaret Üniversitesi', 'İstanbul', 'Ticaret'),
  U('Işık Üniversitesi', 'İstanbul', 'Işık'),
  U('Beykent Üniversitesi', 'İstanbul', 'Beykent'),
  U('Maltepe Üniversitesi', 'İstanbul', 'Maltepe'),
  U('Doğuş Üniversitesi', 'İstanbul', 'Doğuş'),
  U('Haliç Üniversitesi', 'İstanbul', 'Haliç'),
  U('İstanbul Arel Üniversitesi', 'İstanbul', 'Arel'),
  U('İstanbul Gelişim Üniversitesi', 'İstanbul', 'Gelişim'),
  U('İstanbul Okan Üniversitesi', 'İstanbul', 'Okan'),
  U('İstanbul Medipol Üniversitesi', 'İstanbul', 'Medipol'),
  U('Acıbadem Mehmet Ali Aydınlar Üniversitesi', 'İstanbul', 'Acıbadem', ['acibadem']),
  U('Bezmialem Vakıf Üniversitesi', 'İstanbul', 'Bezmialem'),
  U('Üsküdar Üniversitesi', 'İstanbul', 'Üsküdar'),
  U('Altınbaş Üniversitesi', 'İstanbul', 'Altınbaş'),
  U('Biruni Üniversitesi', 'İstanbul', 'Biruni'),
  U('Nişantaşı Üniversitesi', 'İstanbul', 'Nişantaşı'),
  U('Fenerbahçe Üniversitesi', 'İstanbul', 'Fenerbahçe'),
  U('İstanbul Sabahattin Zaim Üniversitesi', 'İstanbul', 'İZÜ', ['izu', 'sabahattin zaim']),
  U('İbn Haldun Üniversitesi', 'İstanbul', 'İbn Haldun'),
  U('İstanbul 29 Mayıs Üniversitesi', 'İstanbul', '29 Mayıs'),
  U('Piri Reis Üniversitesi', 'İstanbul', 'Piri Reis'),
  U('MEF Üniversitesi', 'İstanbul', 'MEF'),
  U('İstanbul Gedik Üniversitesi', 'İstanbul', 'Gedik'),
  U('İstanbul Ayvansaray Üniversitesi', 'İstanbul', 'Ayvansaray'),
  U('İstinye Üniversitesi', 'İstanbul', 'İstinye'),
  U('İstanbul Esenyurt Üniversitesi', 'İstanbul', 'Esenyurt'),
  U('İstanbul Rumeli Üniversitesi', 'İstanbul', 'Rumeli'),
  U('İstanbul Atlas Üniversitesi', 'İstanbul', 'Atlas'),
  U('İstanbul Kent Üniversitesi', 'İstanbul', 'Kent'),
  U('İstanbul Beykoz Üniversitesi', 'İstanbul', 'Beykoz'),
  U('İstanbul Galata Üniversitesi', 'İstanbul', 'Galata'),
  U('İstanbul Topkapı Üniversitesi', 'İstanbul', 'Topkapı'),
  U('İstanbul Yeni Yüzyıl Üniversitesi', 'İstanbul', 'Yeni Yüzyıl'),
  U('İstanbul Sağlık ve Teknoloji Üniversitesi', 'İstanbul', 'İSTÜN', ['istun']),
  U('Demiroğlu Bilim Üniversitesi', 'İstanbul', 'Demiroğlu Bilim'),
  U('Fatih Sultan Mehmet Vakıf Üniversitesi', 'İstanbul', 'FSMVÜ', ['fsm', 'fsmvu']),
  U('Türk Hava Kurumu Üniversitesi', 'Ankara', 'THK Üniversitesi', ['thk']),
  // Ankara
  U('Orta Doğu Teknik Üniversitesi', 'Ankara', 'ODTÜ', ['odtu', 'metu', 'orta dogu']),
  U('Hacettepe Üniversitesi', 'Ankara', 'Hacettepe', ['hu']),
  U('Ankara Üniversitesi', 'Ankara', 'Ankara Üniversitesi', ['au']),
  U('Gazi Üniversitesi', 'Ankara', 'Gazi'),
  U('Ankara Yıldırım Beyazıt Üniversitesi', 'Ankara', 'AYBÜ', ['aybu', 'yildirim beyazit']),
  U('Ankara Hacı Bayram Veli Üniversitesi', 'Ankara', 'Hacı Bayram', ['hbv']),
  U('Ankara Sosyal Bilimler Üniversitesi', 'Ankara', 'ASBÜ', ['asbu']),
  U('Ankara Müzik ve Güzel Sanatlar Üniversitesi', 'Ankara', 'MGÜ'),
  U('İhsan Doğramacı Bilkent Üniversitesi', 'Ankara', 'Bilkent', ['bilkent']),
  U('TOBB Ekonomi ve Teknoloji Üniversitesi', 'Ankara', 'TOBB ETÜ', ['tobb', 'etu']),
  U('Başkent Üniversitesi', 'Ankara', 'Başkent'),
  U('Çankaya Üniversitesi', 'Ankara', 'Çankaya'),
  U('Atılım Üniversitesi', 'Ankara', 'Atılım'),
  U('Ufuk Üniversitesi', 'Ankara', 'Ufuk'),
  U('Ostim Teknik Üniversitesi', 'Ankara', 'Ostim'),
  U('Ankara Bilim Üniversitesi', 'Ankara', 'Ankara Bilim'),
  U('Ankara Medipol Üniversitesi', 'Ankara', 'Ankara Medipol'),
  U('Yüksek İhtisas Üniversitesi', 'Ankara', 'Yüksek İhtisas'),
  U('Lokman Hekim Üniversitesi', 'Ankara', 'Lokman Hekim'),
  U('TED Üniversitesi', 'Ankara', 'TEDÜ', ['tedu']),
  // İzmir
  U('Ege Üniversitesi', 'İzmir', 'Ege'),
  U('Dokuz Eylül Üniversitesi', 'İzmir', 'DEÜ', ['deu', 'dokuz eylul']),
  U('İzmir Yüksek Teknoloji Enstitüsü', 'İzmir', 'İYTE', ['iyte']),
  U('İzmir Katip Çelebi Üniversitesi', 'İzmir', 'İKÇÜ', ['ikcu', 'katip celebi']),
  U('İzmir Bakırçay Üniversitesi', 'İzmir', 'Bakırçay'),
  U('İzmir Demokrasi Üniversitesi', 'İzmir', 'Demokrasi'),
  U('İzmir Ekonomi Üniversitesi', 'İzmir', 'İEÜ', ['ieu']),
  U('Yaşar Üniversitesi', 'İzmir', 'Yaşar'),
  U('İzmir Tınaztepe Üniversitesi', 'İzmir', 'Tınaztepe'),
  // Other cities, alphabetical by city
  U('Çukurova Üniversitesi', 'Adana', 'Çukurova'),
  U('Adana Alparslan Türkeş Bilim ve Teknoloji Üniversitesi', 'Adana', 'ATÜ'),
  U('Adıyaman Üniversitesi', 'Adıyaman'),
  U('Afyon Kocatepe Üniversitesi', 'Afyonkarahisar', 'AKÜ'),
  U('Afyonkarahisar Sağlık Bilimleri Üniversitesi', 'Afyonkarahisar', 'AFSÜ'),
  U('Ağrı İbrahim Çeçen Üniversitesi', 'Ağrı', 'AİÇÜ'),
  U('Aksaray Üniversitesi', 'Aksaray'),
  U('Amasya Üniversitesi', 'Amasya'),
  U('Akdeniz Üniversitesi', 'Antalya', 'Akdeniz'),
  U('Alanya Alaaddin Keykubat Üniversitesi', 'Antalya', 'ALKÜ'),
  U('Antalya Bilim Üniversitesi', 'Antalya', 'Antalya Bilim'),
  U('Antalya Belek Üniversitesi', 'Antalya', 'Belek'),
  U('Alanya Üniversitesi', 'Antalya', 'Alanya Üniversitesi'),
  U('Ardahan Üniversitesi', 'Ardahan'),
  U('Artvin Çoruh Üniversitesi', 'Artvin', 'Artvin Çoruh'),
  U('Aydın Adnan Menderes Üniversitesi', 'Aydın', 'ADÜ', ['adnan menderes']),
  U('Balıkesir Üniversitesi', 'Balıkesir'),
  U('Bandırma Onyedi Eylül Üniversitesi', 'Balıkesir', 'BANÜ'),
  U('Bartın Üniversitesi', 'Bartın'),
  U('Batman Üniversitesi', 'Batman'),
  U('Bayburt Üniversitesi', 'Bayburt'),
  U('Bilecik Şeyh Edebali Üniversitesi', 'Bilecik', 'BŞEÜ'),
  U('Bingöl Üniversitesi', 'Bingöl'),
  U('Bitlis Eren Üniversitesi', 'Bitlis', 'Bitlis Eren'),
  U('Bolu Abant İzzet Baysal Üniversitesi', 'Bolu', 'BAİBÜ', ['abant']),
  U('Burdur Mehmet Akif Ersoy Üniversitesi', 'Burdur', 'MAKÜ', ['mehmet akif']),
  U('Bursa Uludağ Üniversitesi', 'Bursa', 'Uludağ', ['uludag']),
  U('Bursa Teknik Üniversitesi', 'Bursa', 'BTÜ'),
  U('Mudanya Üniversitesi', 'Bursa', 'Mudanya'),
  U('Çanakkale Onsekiz Mart Üniversitesi', 'Çanakkale', 'ÇOMÜ', ['comu']),
  U('Çankırı Karatekin Üniversitesi', 'Çankırı', 'Karatekin'),
  U('Hitit Üniversitesi', 'Çorum', 'Hitit'),
  U('Pamukkale Üniversitesi', 'Denizli', 'Pamukkale', ['pau']),
  U('Dicle Üniversitesi', 'Diyarbakır', 'Dicle'),
  U('Düzce Üniversitesi', 'Düzce'),
  U('Trakya Üniversitesi', 'Edirne', 'Trakya'),
  U('Fırat Üniversitesi', 'Elazığ', 'Fırat'),
  U('Erzincan Binali Yıldırım Üniversitesi', 'Erzincan', 'EBYÜ'),
  U('Atatürk Üniversitesi', 'Erzurum', 'Atatürk Üniversitesi', ['ataturk']),
  U('Erzurum Teknik Üniversitesi', 'Erzurum', 'ETÜ'),
  U('Anadolu Üniversitesi', 'Eskişehir', 'Anadolu', ['aof', 'açıköğretim']),
  U('Eskişehir Osmangazi Üniversitesi', 'Eskişehir', 'ESOGÜ', ['ogu', 'osmangazi']),
  U('Eskişehir Teknik Üniversitesi', 'Eskişehir', 'ESTÜ'),
  U('Gaziantep Üniversitesi', 'Gaziantep', 'GAÜN', ['gaun']),
  U('Gaziantep İslam Bilim ve Teknoloji Üniversitesi', 'Gaziantep', 'GİBTÜ'),
  U('Hasan Kalyoncu Üniversitesi', 'Gaziantep', 'Hasan Kalyoncu'),
  U('SANKO Üniversitesi', 'Gaziantep', 'SANKO'),
  U('Giresun Üniversitesi', 'Giresun'),
  U('Gümüşhane Üniversitesi', 'Gümüşhane'),
  U('Hakkari Üniversitesi', 'Hakkari'),
  U('Hatay Mustafa Kemal Üniversitesi', 'Hatay', 'MKÜ', ['mustafa kemal']),
  U('Iğdır Üniversitesi', 'Iğdır'),
  U('Süleyman Demirel Üniversitesi', 'Isparta', 'SDÜ', ['sdu']),
  U('Isparta Uygulamalı Bilimler Üniversitesi', 'Isparta', 'ISUBÜ'),
  U('Kahramanmaraş Sütçü İmam Üniversitesi', 'Kahramanmaraş', 'KSÜ'),
  U('Kahramanmaraş İstiklal Üniversitesi', 'Kahramanmaraş', 'İstiklal'),
  U('Karabük Üniversitesi', 'Karabük'),
  U('Karamanoğlu Mehmetbey Üniversitesi', 'Karaman', 'KMÜ'),
  U('Kafkas Üniversitesi', 'Kars', 'Kafkas'),
  U('Kastamonu Üniversitesi', 'Kastamonu'),
  U('Erciyes Üniversitesi', 'Kayseri', 'Erciyes'),
  U('Kayseri Üniversitesi', 'Kayseri'),
  U('Abdullah Gül Üniversitesi', 'Kayseri', 'AGÜ', ['agu']),
  U('Nuh Naci Yazgan Üniversitesi', 'Kayseri', 'NNYÜ'),
  U('Kırıkkale Üniversitesi', 'Kırıkkale'),
  U('Kırklareli Üniversitesi', 'Kırklareli'),
  U('Kırşehir Ahi Evran Üniversitesi', 'Kırşehir', 'Ahi Evran'),
  U('Kilis 7 Aralık Üniversitesi', 'Kilis', 'Kilis 7 Aralık'),
  U('Kocaeli Üniversitesi', 'Kocaeli', 'KOÜ', ['kou']),
  U('Gebze Teknik Üniversitesi', 'Kocaeli', 'GTÜ', ['gtu']),
  U('Kocaeli Sağlık ve Teknoloji Üniversitesi', 'Kocaeli', 'KOSTÜ'),
  U('Selçuk Üniversitesi', 'Konya', 'Selçuk'),
  U('Necmettin Erbakan Üniversitesi', 'Konya', 'NEÜ', ['erbakan']),
  U('Konya Teknik Üniversitesi', 'Konya', 'KTÜN'),
  U('KTO Karatay Üniversitesi', 'Konya', 'KTO Karatay'),
  U('Konya Gıda ve Tarım Üniversitesi', 'Konya', 'Gıda ve Tarım'),
  U('Kütahya Dumlupınar Üniversitesi', 'Kütahya', 'Dumlupınar', ['dpu']),
  U('Kütahya Sağlık Bilimleri Üniversitesi', 'Kütahya', 'KSBÜ'),
  U('İnönü Üniversitesi', 'Malatya', 'İnönü'),
  U('Malatya Turgut Özal Üniversitesi', 'Malatya', 'Turgut Özal'),
  U('Manisa Celal Bayar Üniversitesi', 'Manisa', 'MCBÜ', ['celal bayar']),
  U('Mardin Artuklu Üniversitesi', 'Mardin', 'Artuklu'),
  U('Mersin Üniversitesi', 'Mersin', 'MEÜ'),
  U('Tarsus Üniversitesi', 'Mersin', 'Tarsus'),
  U('Toros Üniversitesi', 'Mersin', 'Toros'),
  U('Çağ Üniversitesi', 'Mersin', 'Çağ'),
  U('Muğla Sıtkı Koçman Üniversitesi', 'Muğla', 'MSKÜ'),
  U('Muş Alparslan Üniversitesi', 'Muş', 'Muş Alparslan'),
  U('Nevşehir Hacı Bektaş Veli Üniversitesi', 'Nevşehir', 'NEVÜ'),
  U('Kapadokya Üniversitesi', 'Nevşehir', 'Kapadokya'),
  U('Niğde Ömer Halisdemir Üniversitesi', 'Niğde', 'NÖHÜ'),
  U('Ordu Üniversitesi', 'Ordu'),
  U('Osmaniye Korkut Ata Üniversitesi', 'Osmaniye', 'Korkut Ata'),
  U('Recep Tayyip Erdoğan Üniversitesi', 'Rize', 'RTEÜ'),
  U('Sakarya Üniversitesi', 'Sakarya', 'SAÜ', ['sau']),
  U('Sakarya Uygulamalı Bilimler Üniversitesi', 'Sakarya', 'SUBÜ'),
  U('Ondokuz Mayıs Üniversitesi', 'Samsun', 'OMÜ', ['omu', '19 mayis']),
  U('Samsun Üniversitesi', 'Samsun'),
  U('Siirt Üniversitesi', 'Siirt'),
  U('Sinop Üniversitesi', 'Sinop'),
  U('Sivas Cumhuriyet Üniversitesi', 'Sivas', 'Cumhuriyet'),
  U('Sivas Bilim ve Teknoloji Üniversitesi', 'Sivas', 'SBTÜ'),
  U('Harran Üniversitesi', 'Şanlıurfa', 'Harran'),
  U('Şırnak Üniversitesi', 'Şırnak'),
  U('Tekirdağ Namık Kemal Üniversitesi', 'Tekirdağ', 'NKÜ', ['namik kemal']),
  U('Tokat Gaziosmanpaşa Üniversitesi', 'Tokat', 'GOP', ['gaziosmanpasa']),
  U('Karadeniz Teknik Üniversitesi', 'Trabzon', 'KTÜ', ['ktu']),
  U('Trabzon Üniversitesi', 'Trabzon'),
  U('Avrasya Üniversitesi', 'Trabzon', 'Avrasya'),
  U('Munzur Üniversitesi', 'Tunceli', 'Munzur'),
  U('Uşak Üniversitesi', 'Uşak'),
  U('Van Yüzüncü Yıl Üniversitesi', 'Van', 'YYÜ', ['yuzuncu yil']),
  U('Yalova Üniversitesi', 'Yalova'),
  U('Yozgat Bozok Üniversitesi', 'Yozgat', 'Bozok'),
  U('Zonguldak Bülent Ecevit Üniversitesi', 'Zonguldak', 'BEÜN', ['bulent ecevit']),
  // KKTC
  U('Doğu Akdeniz Üniversitesi', 'KKTC', 'DAÜ', ['dau', 'emu']),
  U('Yakın Doğu Üniversitesi', 'KKTC', 'YDÜ', ['ydu', 'neu']),
  U('Girne Amerikan Üniversitesi', 'KKTC', 'GAÜ', ['gau']),
  U('Uluslararası Kıbrıs Üniversitesi', 'KKTC', 'UKÜ', ['ciu']),
  U('Lefke Avrupa Üniversitesi', 'KKTC', 'LAÜ'),
  U('Orta Doğu Teknik Üniversitesi Kuzey Kıbrıs Kampusu', 'KKTC', 'ODTÜ KKK', ['metu ncc']),
]

/** Lower case without Turkish accents, so "odtu", "ODTÜ" and "orta doğu" all match. */
export function fold(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşüâîû]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' })[c] ?? c)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Universities matching a search, best first: short name or alias hits, then name starts, then the rest. */
export function searchUniversities(query: string, limit = 8): University[] {
  const q = fold(query)
  if (!q) return []
  const scored: Array<{ u: University; score: number }> = []
  for (const u of UNIVERSITIES) {
    const keys = [u.short, ...(u.aliases ?? [])].map(fold)
    const name = fold(u.name)
    const city = fold(u.city)
    let score = 0
    if (keys.some((k) => k === q)) score = 4
    else if (name.startsWith(q) || keys.some((k) => k.startsWith(q))) score = 3
    else if (name.split(' ').some((w) => w.startsWith(q))) score = 2
    else if (name.includes(q) || city.startsWith(q)) score = 1
    if (score) scored.push({ u, score })
  }
  return scored
    .sort((a, b) => b.score - a.score || a.u.name.localeCompare(b.u.name, 'tr'))
    .slice(0, limit)
    .map((s) => s.u)
}
