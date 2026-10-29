export interface Note {
  id: string;
  title: string;
  course: string;
  content: string;
  createdAt: string;
  fileName?: string;
  isDemo?: boolean;
}

export interface Attempt {
  noteId: string;
  score: number;
  total: number;
  completedAt: string;
}

export interface Workspace {
  version: 1;
  notes: Note[];
  attempts: Attempt[];
}

export const DEMO_NOTE: Note = {
  id: 'demo-learning',
  title: 'Öğrenme ve bellek',
  course: 'Psikolojiye Giriş',
  createdAt: '2026-10-29T09:00:00Z',
  isDemo: true,
  content: `Öğrenme ve Bellek

Öğrenme: Deneyim sonucunda bilgi veya davranışta ortaya çıkan görece kalıcı değişimdir. Öğrenme, yalnızca bilgiyi okumayı değil, bilgiyi anlamlandırmayı ve gerektiğinde kullanabilmeyi içerir.

Çalışma belleği: Bilgiyi kısa bir süre boyunca tutan ve üzerinde işlem yapmamızı sağlayan bellek sistemidir. Çalışma belleğinin kapasitesi sınırlıdır; aynı anda çok fazla yeni bilgi sunulması öğrenmeyi zorlaştırabilir.

Uzun süreli bellek: Bilgilerin, becerilerin ve deneyimlerin uzun zaman boyunca saklandığı bellek sistemidir. Yeni bilgiyi önceki bilgilerle ilişkilendirmek, uzun süreli bellekte daha anlamlı bağlantılar kurulmasına yardımcı olur.

Aktif hatırlama: Öğrenilen bilgiyi kaynağa bakmadan zihinden geri getirme çabasıdır. Notları kapatıp bir konuyu kendi cümlelerinle açıklamak veya deneme soruları çözmek aktif hatırlamaya örnektir. Bu yöntem, yalnızca tekrar okumaya kıyasla bilginin kalıcılığını artırabilir.

Aralıklı tekrar: Çalışma oturumlarını tek bir uzun oturum yerine zamana yayma yöntemidir. Bir konuyu bugün, birkaç gün sonra ve bir hafta sonra tekrar etmek aralıklı tekrara örnektir. Tekrarlar arasındaki uygun süre, bilginin zorluğuna ve ne kadar süre hatırlanmak istendiğine bağlıdır.

Geri bildirim: Bir yanıtın doğruluğu ve nasıl geliştirilebileceği hakkında verilen bilgidir. Test sonrasında yanlış cevabın neden yanlış olduğunu incelemek, yanlış bilgilerin düzeltilmesine yardımcı olur. Sadece puanı görmek yerine çözümün mantığını değerlendirmek öğrenmeyi destekler.

Üstbiliş: Kişinin kendi düşünme ve öğrenme süreçlerini izlemesi ve düzenlemesidir. Bir öğrenci hangi konuları bildiğini ve hangi konularda zorlandığını değerlendirerek çalışma planını değiştirebilir. Kendini test etmek, öğrenme düzeyini yalnızca tanıdıklık hissine göre değerlendirmekten daha somut bilgi sağlar.

Bilgiyi yeni bir duruma uygulamak, öğrenmenin aktarımını destekler. Örneğin bir öğrenci aralıklı tekrar ilkesini kullanarak haftalık ders çalışma programını düzenleyebilir. Etkili bir çalışma oturumu, kısa bir tekrarın ardından aktif hatırlama ve geri bildirim aşamalarını içerebilir.`,
};

const STORAGE_KEY = 'studymode.workspace.v1';

export function loadWorkspace(): { workspace: Workspace; warning?: string } {
  const empty: Workspace = { version: 1, notes: [], attempts: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { workspace: empty };
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 ||
      !('notes' in data) || !Array.isArray(data.notes) || !('attempts' in data) || !Array.isArray(data.attempts)) {
      return { workspace: empty, warning: 'Kayıtlı çalışma alanı okunamadı. Yeni not eklemeden önce tarayıcı verilerini kontrol et.' };
    }
    const validNotes = data.notes.every((n: Note) => n && typeof n.id === 'string' && typeof n.title === 'string' &&
      typeof n.course === 'string' && typeof n.content === 'string' && n.content.length <= 400_000 &&
      typeof n.createdAt === 'string' && Number.isFinite(Date.parse(n.createdAt)));
    const validAttempts = data.attempts.every((a: Attempt) => a && typeof a.noteId === 'string' &&
      Number.isInteger(a.score) && Number.isInteger(a.total) && a.score >= 0 && a.total > 0 && a.score <= a.total &&
      typeof a.completedAt === 'string');
    if (!validNotes || !validAttempts) return { workspace: empty, warning: 'Kayıtlı verinin biçimi geçersiz. Mevcut tarayıcı kaydı değiştirilmedi.' };
    return { workspace: data as Workspace };
  } catch {
    return { workspace: empty, warning: 'Tarayıcı kaydına erişilemedi. Notların bu oturumda açık kalır; kalıcı kayıt için tarayıcı izinlerini kontrol et.' };
  }
}

export function saveWorkspace(workspace: Workspace): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
    return true;
  } catch {
    return false;
  }
}

export const wordCount = (text: string) => text.trim().split(/\s+/u).filter(Boolean).length;
export const readingMinutes = (text: string) => Math.max(1, Math.ceil(wordCount(text) / 180));
