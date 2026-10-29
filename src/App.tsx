import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowRight, Asterisk, BookOpen, Check, CheckCheck, ChevronLeft, ChevronRight, CircleHelp, Clock3, FileText, FolderOpen, GraduationCap, LayoutGrid, Lightbulb, ListChecks, LoaderCircle, LockKeyhole, Menu, Plus, RotateCcw, Search, Sparkles, Target, Trash2, Upload, X } from 'lucide-react';
import { ACCEPTED_NOTE_EXTENSIONS, extractNoteText } from './lib/importNote';
import { generateStudySet, type QuizQuestion, type StudySet } from './lib/study';
import { DEMO_NOTE, loadWorkspace, readingMinutes, saveWorkspace, wordCount, type Attempt, type Note, type Workspace } from './lib/notes';

type View = 'home' | 'library' | 'study';
type StudyTab = 'summary' | 'quiz' | 'cards' | 'practice';

export default function App() {
  const [initial] = useState(loadWorkspace);
  const [workspace, setWorkspace] = useState(initial.workspace);
  const [warning, setWarning] = useState(initial.warning ?? '');
  const [view, setView] = useState<View>('home');
  const [selected, setSelected] = useState<Note | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  function persist(next: Workspace) {
    setWorkspace(next);
    setWarning(saveWorkspace(next) ? '' : 'Tarayıcıya kaydedilemedi. Notların bu oturumda kullanılabilir; sayfayı kapatmadan kaynak dosyanı sakla.');
  }

  function navigate(next: View) {
    setView(next);
    setMenuOpen(false);
    setSearch('');
    window.scrollTo({ top: 0 });
  }

  function openNote(note: Note) {
    setSelected(note);
    navigate('study');
  }

  function addNote(note: Note) {
    persist({ ...workspace, notes: [note, ...workspace.notes] });
    setUploadOpen(false);
    openNote(note);
    setToast('Çalışma setin hazır. İlk küçük adım tamam!');
  }

  function deleteNote(note: Note) {
    if (!window.confirm(`“${note.title}” ve bu nota ait test sonuçları bu cihazdan silinsin mi?`)) return;
    persist({ ...workspace, notes: workspace.notes.filter(n => n.id !== note.id), attempts: workspace.attempts.filter(a => a.noteId !== note.id) });
    setToast('Not silindi.');
  }

  function completeQuiz(score: number, total: number) {
    if (!selected) return;
    const attempt: Attempt = { noteId: selected.id, score, total, completedAt: new Date().toISOString() };
    persist({ ...workspace, attempts: [...workspace.attempts, attempt].slice(-200) });
  }

  const average = workspace.attempts.length
    ? Math.round(workspace.attempts.reduce((sum, a) => sum + (a.score / a.total) * 100, 0) / workspace.attempts.length)
    : null;
  const query = search.toLocaleLowerCase('tr').trim();
  const filteredNotes = workspace.notes.filter(n => `${n.title} ${n.course}`.toLocaleLowerCase('tr').includes(query));

  return <div className="app-shell">
    {menuOpen && <button className="sidebar-scrim" aria-label="Menüyü kapat" onClick={() => setMenuOpen(false)} />}
    <aside className={`sidebar ${menuOpen ? 'is-open' : ''}`} aria-label="Ana menü">
      <button className="brand" onClick={() => navigate('home')} aria-label="studymode ana sayfa">
        <span className="brand-symbol"><Asterisk size={28} strokeWidth={2.8} /></span><span>study<span className="brand-light">mode</span><span className="brand-dot">.</span></span>
      </button>
      <div className="workspace-label"><span className="workspace-avatar"><GraduationCap size={18} /></span><div>Kişisel alanın<small>Biraz merak, bolca keşif.</small></div></div>
      <div className="nav-caption">ÇALIŞMA ALANIN</div>
      <nav className="nav-items">
        <button className={view === 'home' ? 'active' : ''} onClick={() => navigate('home')}><LayoutGrid size={19} /> Genel bakış</button>
        <button className={view === 'library' || (view === 'study' && !selected?.isDemo) ? 'active' : ''} onClick={() => navigate('library')}><FolderOpen size={19} /> Notlarım <span className="nav-count">{workspace.notes.length}</span></button>
        <button className={view === 'study' && selected?.isDemo ? 'active' : ''} onClick={() => openNote(DEMO_NOTE)}><Sparkles size={19} /> Örnek çalışma seti</button>
      </nav>
      <div className="sidebar-note"><div className="little-sun"><Asterisk size={27} /></div><h3>Her şey bir<br />küçük adımla.</h3><p>Bugün öğrendiğin tek bir şey bile ilerlemektir.</p><span className="note-doodle" aria-hidden="true">↗</span></div>
      <div className="sidebar-bottom"><button onClick={() => setHelpOpen(true)}><CircleHelp size={18} /> Nasıl çalışır?</button><div className="local-status"><span /> Bu cihazda, sana özel <LockKeyhole size={12} /></div></div>
    </aside>

    <div className="main-shell">
      <header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menüyü aç" aria-expanded={menuOpen}><Menu size={22} /></button><span className="breadcrumb">Çalışma alanın <ChevronRight size={13} /><strong>{view === 'home' ? 'Genel bakış' : view === 'library' ? 'Notlarım' : 'Çalışma seti'}</strong></span></div><div className="topbar-right"><span className="beta-label">BİRAZ DAHA İYİ ÖĞREN</span><button className="button primary small" onClick={() => setUploadOpen(true)}><Plus size={17} /> Yeni not ekle</button></div></header>
      <main id="main-content" className="main-content">
        {warning && <div className="warning" role="alert"><CircleHelp size={19} /><span>{warning}</span><button className="icon-button" onClick={() => setWarning('')} aria-label="Uyarıyı kapat"><X size={17} /></button></div>}
        {view === 'study' && selected ? <StudyView key={selected.id} note={selected} onBack={() => navigate('library')} onComplete={completeQuiz} /> : <>
          <div className="page-heading"><div><div className="eyebrow">{view === 'home' ? 'SENİN TEMPON, SENİN MODUN' : 'HER ŞEY BİR ARADA'}</div><h1>{view === 'home' ? 'Öğrenmeye yer aç.' : 'Notların, düzenli bir yerde.'}</h1><p>{view === 'home' ? 'Karmaşık notlardan, küçük “şimdi anladım” anlarına.' : 'Bir konuyu seç. Kaldığın yerden öğrenmeye devam et.'}</p></div><div className="heading-date"><span className="date-icon"><BookOpen size={19} /></span><span>Bir sayfa, bir adım.<small>Kendi hızında ilerle.</small></span></div></div>

          {view === 'home' && <>
            <section className="hero" aria-label="Notlarından çalışma seti oluştur">
              <div className="hero-copy"><span className="hero-pill"><span /> ODAĞIN ÖĞRENMEK OLSUN</span><h2>Notların çok.<br />Yolun <span>artık daha net.</span><svg className="underline" viewBox="0 0 240 12" aria-hidden="true"><path d="M3 8 Q100 -2 235 5" /></svg></h2><p>Ders notlarını yükle. Özünü yakala, mini testlerle<br className="desktop-break" /> kendini sına. Öğrendiklerin gerçekten senin olsun.</p><div className="hero-actions"><button className="button dark" onClick={() => setUploadOpen(true)}><Upload size={17} /> Notlarını yükle <ArrowRight size={17} /></button><button className="text-button" onClick={() => openNote(DEMO_NOTE)}>Önce bir örneğe bak <ArrowRight size={15} /></button></div><div className="supported-formats"><FileText size={13} /> PDF, TXT, Markdown <span>·</span> En fazla 10 MB</div></div>
              <StudyIllustration />
            </section>
            <section className="stats" aria-label="Çalışma istatistiklerin">
              <Stat icon={<FolderOpen size={21} />} value={String(workspace.notes.length).padStart(2, '0')} label="Çalışma notu" tone="peach" detail="Bilgine bir yer aç" />
              <Stat icon={<CheckCheck size={21} />} value={String(workspace.attempts.length).padStart(2, '0')} label="Tamamlanan test" tone="green" detail="Her deneme bir adım" />
              <Stat icon={<Target size={21} />} value={average === null ? '—' : `%${average}`} label="Ortalama başarı" tone="purple" detail={average === null ? 'İlk testinle başlayacak' : 'Tamamladığın testlerde'} />
            </section>
          </>}

          <section className="notes-section" aria-labelledby="notes-heading"><div className="section-heading"><div><h2 id="notes-heading">{view === 'home' ? 'Sıradaki “anladım” anın' : 'Çalışma notların'} <span className="count-pill">{workspace.notes.length}</span></h2><p>{workspace.notes.length ? 'Bir not seç, kendine küçük bir öğrenme molası ver.' : 'İlk notunu ekle veya örnek setle neler yapabileceğini keşfet.'}</p></div>{view === 'home' && workspace.notes.length > 0 ? <button className="text-button muted" onClick={() => navigate('library')}>Tüm notlar <ArrowRight size={16} /></button> : view === 'library' && <label className="search"><Search size={17} /><input aria-label="Notlarda ara" placeholder="Notlarında ara..." value={search} onChange={e => setSearch(e.target.value)} /></label>}</div>
            <div className="notes-grid">
              {(view === 'home' ? filteredNotes.slice(0, 3) : filteredNotes).map((note, index) => <NoteCard key={note.id} note={note} index={index} onOpen={openNote} onDelete={deleteNote} attempts={workspace.attempts.filter(a => a.noteId === note.id)} />)}
              {workspace.notes.length === 0 && !query && <NoteCard note={DEMO_NOTE} index={0} onOpen={openNote} attempts={workspace.attempts.filter(a => a.noteId === DEMO_NOTE.id)} />}
              {!query && <button className="add-note-card" onClick={() => setUploadOpen(true)}><span><Plus size={23} /></span><strong>Yeni bir başlangıç</strong><p>Ders notunu ekle,<br />birlikte sadeleştirelim.</p><span className="add-note-link">Not ekle <ArrowRight size={14} /></span></button>}
              {query && filteredNotes.length === 0 && <div className="empty-search"><Search size={26} /><h3>Bu aramada not bulunamadı.</h3><p>Başka bir başlık veya ders adı deneyebilirsin.</p><button className="text-button" onClick={() => setSearch('')}>Aramayı temizle</button></div>}
            </div>
          </section>
          {view === 'home' && <section className="learning-tip"><div className="tip-icon"><Lightbulb size={24} /></div><div><span>KÜÇÜK BİR ÇALIŞMA İPUCU</span><h3>Bir kez daha okumak yerine, bir kez hatırlamayı dene.</h3><p>Notunu kapatıp kendine anlatmak, neyi gerçekten bildiğini görmene yardımcı olur.</p></div><button className="text-button" onClick={() => openNote(workspace.notes[0] ?? DEMO_NOTE)}>Hadi deneyelim <ArrowRight size={17} /></button></section>}
          <footer className="page-footer"><span><Asterisk size={16} /> Mükemmel çalışmak değil, biraz daha anlamak.</span><span>Senin hızın. Senin modun.</span></footer>
        </>}
      </main>
    </div>
    {uploadOpen && <UploadDialog onClose={() => setUploadOpen(false)} onAdd={addNote} />}
    {helpOpen && <Dialog title="Bir nottan, daha fazlasına." onClose={() => setHelpOpen(false)}><p className="dialog-intro">Büyük çalışma oturumları yerine, küçük ve anlamlı adımlar.</p><div className="how-steps"><div><span>01</span><section><h3>Notunu ekle</h3><p>Metni seçilebilen PDF, TXT veya Markdown yükle; istersen doğrudan metin yapıştır.</p></section></div><div><span>02</span><section><h3>Özüne odaklan</h3><p>Notundaki önemli cümleleri ve kavramları kısa bir seçkide gör.</p></section></div><div><span>03</span><section><h3>Kendini sına</h3><p>Notlarından hazırlanan boşluk doldurma testlerini çöz. Açıklamalarla kaynağa geri dön.</p></section></div></div><div className="info-box"><LockKeyhole size={19} /><p>Bu ilk sürüm cihazında çalışır. Dosyaların sunucuya gönderilmez; notlar ve test sonuçları bu tarayıcıda tutulur. Tarayıcı verilerini silersen kayıtların da silinir. Özet ve sorular notundan kurallarla seçilir; harici yapay zekâ kullanılmaz.</p></div></Dialog>}
    {toast && <div className="toast" role="status"><Check size={18} />{toast}</div>}
  </div>;
}

function Stat({ icon, value, label, tone, detail }: { icon: ReactNode; value: string; label: string; tone: string; detail: string }) {
  return <div className="stat"><span className={`stat-icon ${tone}`}>{icon}</span><div><div className="stat-top"><strong>{value}</strong><span>{label}</span></div><p>{detail}</p></div></div>;
}

function StudyIllustration() {
  return <div className="study-illustration" aria-hidden="true"><div className="illustration-orbit orbit-one" /><div className="illustration-orbit orbit-two" /><span className="illustration-spark spark-one">✳</span><span className="illustration-spark spark-two">✧</span><div className="paper paper-back"><span /><span /><span /></div><div className="paper paper-front"><div className="paper-top"><span className="paper-icon"><BookOpen size={18} /></span><span>Daha az karmaşa.</span><span className="paper-dots">···</span></div><h3>Daha çok<br /><em>“şimdi anladım.”</em></h3><div className="paper-line" /><div className="paper-line short" /><div className="paper-highlight"><Check size={15} /> Ana fikir, cebinde.</div><div className="paper-line medium" /><div className="paper-bottom"><span>Bir adım daha ileri</span><span>↗</span></div></div><div className="floating-label"><span><Check size={15} /></span>İşte bu kadar net.</div><svg className="illustration-arrow" viewBox="0 0 90 60"><path d="M5 6Q80 0 70 43M55 31l16 15 12-18" /></svg></div>;
}

function NoteCard({ note, index, onOpen, onDelete, attempts }: { note: Note; index: number; onOpen: (n: Note) => void; onDelete?: (n: Note) => void; attempts: Attempt[] }) {
  const last = attempts.at(-1);
  return <article className={`note-card tone-${index % 3}`}><div className="note-card-top"><span className="document-icon"><FileText size={23} /></span>{note.isDemo ? <span className="demo-badge">ÖRNEK NOT</span> : <button className="icon-button delete-note" aria-label={`${note.title} notunu sil`} onClick={() => onDelete?.(note)}><Trash2 size={16} /></button>}</div><button className="note-card-content" onClick={() => onOpen(note)}><span className="course-label">{note.course || 'Kişisel not'}</span><h3>{note.title}</h3><p>{note.isDemo ? 'Nasıl öğrendiğimizi öğrenmekle başlayalım.' : `${wordCount(note.content).toLocaleString('tr-TR')} kelimelik notun, daha anlaşılır bir çalışma setine hazır.`}</p><div className="note-meta"><span><Clock3 size={13} /> {readingMinutes(note.content)} dk okuma</span><span>{note.isDemo ? 'Keşfetmeye hazır' : new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' }).format(new Date(note.createdAt))}</span></div><div className="note-card-footer"><span>{last ? <><CheckCheck size={15} /> Son test: {last.score}/{last.total}</> : <><span className="tiny-dot" /> Çalışmaya hazır</>}</span><span className="open-note">{note.isDemo ? 'Örneği keşfet' : 'Çalışmaya başla'}<ArrowRight size={16} /></span></div></button></article>;
}

function Dialog({ title, onClose, children, className = '' }: { title: string; onClose: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog ref={ref} className={`dialog ${className}`} aria-labelledby="dialog-heading" onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) { const rect = e.currentTarget.getBoundingClientRect(); if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) onClose(); } }}><div className="dialog-heading"><div className="dialog-symbol"><Upload size={21} /></div><button className="icon-button" aria-label="Pencereyi kapat" onClick={onClose}><X size={22} /></button></div><h2 id="dialog-heading">{title}</h2>{children}</dialog>;
}

function UploadDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (note: Note) => void }) {
  const [mode, setMode] = useState<'file' | 'text'>('file');
  const [title, setTitle] = useState('');
  const [course, setCourse] = useState('');
  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function selectFile(file?: File) {
    if (!file || busy) return;
    setError(''); setBusy(true); setContent(''); setFileName('');
    try {
      const text = await extractNoteText(file);
      setContent(text); setFileName(file.name);
      if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, '').slice(0, 100));
    } catch (e) { setError(e instanceof Error ? e.message : 'Dosya okunamadı. Tekrar deneyebilirsin.'); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(''); setBusy(true);
    await new Promise(resolve => window.setTimeout(resolve, 40));
    try {
      if (!title.trim()) throw new Error('Notuna kısa bir başlık ekle.');
      generateStudySet(content);
      onAdd({ id: crypto.randomUUID(), title: title.trim(), course: course.trim() || 'Genel', content: content.trim(), createdAt: new Date().toISOString(), ...(mode === 'file' && fileName ? { fileName } : {}) });
    } catch (e) { setError(e instanceof Error ? e.message : 'Çalışma seti oluşturulamadı.'); }
    finally { setBusy(false); }
  }

  return <Dialog title="Bir not ekle. Bir adım ilerle." onClose={onClose}><p className="dialog-intro">Ders notunu, sana ait bir çalışma setine dönüştürelim.</p><form onSubmit={submit}><div className="input-mode" role="tablist" aria-label="Not ekleme yöntemi"><button type="button" role="tab" aria-selected={mode === 'file'} className={mode === 'file' ? 'active' : ''} disabled={busy} onClick={() => { setMode('file'); setError(''); }}><Upload size={16} /> Dosya yükle</button><button type="button" role="tab" aria-selected={mode === 'text'} className={mode === 'text' ? 'active' : ''} disabled={busy} onClick={() => { setMode('text'); setError(''); }}><FileText size={16} /> Metin yapıştır</button></div>
      {mode === 'file' ? <><input ref={fileRef} type="file" className="sr-only" tabIndex={-1} accept={ACCEPTED_NOTE_EXTENSIONS} onChange={e => void selectFile(e.target.files?.[0])} aria-label="Not dosyası" /><button type="button" className={`dropzone ${dragging ? 'dragging' : ''} ${fileName ? 'has-file' : ''}`} disabled={busy} onClick={() => fileRef.current?.click()} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); void selectFile(e.dataTransfer.files[0]); }}><span className="dropzone-icon">{busy ? <LoaderCircle size={25} className="spin" /> : fileName ? <Check size={25} /> : <ArrowDownToLine size={25} />}</span><strong>{busy ? 'Notun okunuyor…' : fileName || 'Notunu buraya bırak'}</strong><span>{fileName ? `${wordCount(content)} kelime okundu · Değiştirmek için tıkla` : 'veya dosya seçmek için tıkla'}</span><small>PDF, TXT, MD · En fazla 10 MB / 150 sayfa</small></button></> : <label className="field">Ders notun<textarea autoFocus rows={7} value={content} onChange={e => setContent(e.target.value)} maxLength={400_000} placeholder="Başlıkları, kavramları ve açıklamalarıyla ders notunu buraya yapıştır…" required /><small>En az 120 karakter. Tanım ve açıklamalar içeren notlar daha iyi sonuç verir.</small></label>}
      <div className="form-columns"><label className="field">Not başlığı<input value={title} onChange={e => setTitle(e.target.value)} maxLength={100} placeholder="Örn. Öğrenme ve bellek" required /></label><label className="field">Ders adı <span className="optional">(isteğe bağlı)</span><input value={course} onChange={e => setCourse(e.target.value)} maxLength={60} placeholder="Örn. Psikolojiye Giriş" /></label></div>
      {error && <p className="form-error" role="alert"><CircleHelp size={17} /> {error}</p>}<div className="upload-privacy"><LockKeyhole size={14} /><span>Notun cihazında kalır. Hiçbir sunucuya gönderilmez.</span></div><button className="button primary full-width" type="submit" disabled={busy || (mode === 'file' && !fileName)}>{busy ? <><LoaderCircle size={17} className="spin" /> Hazırlanıyor…</> : <>Çalışma setimi oluştur <ArrowRight size={17} /></>}</button></form></Dialog>;
}

function StudyView({ note, onBack, onComplete }: { note: Note; onBack: () => void; onComplete: (score: number, total: number) => void }) {
  const [tab, setTab] = useState<StudyTab>('summary');
  const generated = useMemo(() => {
    try { return { data: generateStudySet(note.content), error: '' }; }
    catch (e) { return { data: null, error: e instanceof Error ? e.message : 'Bu not işlenemedi.' }; }
  }, [note.content]);
  const set = generated.data;
  const tabs: { id: StudyTab; label: string; icon: ReactNode; count?: number }[] = [
    { id: 'summary', label: 'Kısa özet', icon: <FileText size={17} /> },
    { id: 'quiz', label: 'Mini test', icon: <ListChecks size={17} />, count: set?.quiz.length },
    { id: 'cards', label: 'Çalışma kartları', icon: <BookOpen size={17} />, count: set?.cards.length },
    { id: 'practice', label: 'Uygula', icon: <Lightbulb size={17} /> },
  ];
  return <div className="study-view"><button className="text-button back-button" onClick={onBack}><ArrowLeft size={16} /> Notlarıma dön</button><div className="study-title"><div><div className="eyebrow">{note.course}{note.isDemo && <span className="demo-badge">ÖRNEK ÇALIŞMA SETİ</span>}</div><h1>{note.title}</h1><p><FileText size={14} /> {wordCount(note.content)} kelime <span>·</span><Clock3 size={14} /> {readingMinutes(note.content)} dk okuma</p></div><span className="study-title-icon"><BookOpen size={31} /></span></div><div className="study-tabs" role="tablist" aria-label="Çalışma yöntemi">{tabs.map(t => <button key={t.id} id={`tab-${t.id}`} role="tab" aria-selected={tab === t.id} aria-controls="study-panel" className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>{t.icon}{t.label}{t.count !== undefined && <span>{t.count}</span>}</button>)}</div>
    {generated.error && <div className="warning" role="alert">{generated.error}</div>}
    {set && <div id="study-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="study-panel">
      {tab === 'summary' && <div className="summary-layout"><section className="content-card summary-card"><div className="card-eyebrow"><span className="small-icon peach"><Sparkles size={18} /></span> KONUNUN ÖZÜ</div><h2>Büyük resim, kısa notlar.</h2><p className="section-description">Kaynak notundan seçilen önemli cümleler. Önce bütünü gör, sonra ayrıntıya in.</p><ol className="summary-list">{set.summary.map((sentence, i) => <li key={i}><span>{String(i + 1).padStart(2, '0')}</span><p>{sentence}</p></li>)}</ol><div className="source-disclaimer"><FileText size={15} /> Bu seçki yalnızca yüklediğin nottan oluşturuldu.</div></section><aside className="summary-aside"><section className="content-card"><div className="card-eyebrow"><Target size={17} /> ODAK NOKTALARI</div><h3>Bu kavramlar sende mi?</h3><div className="keyword-list">{set.keywords.map(keyword => <span key={keyword}>{keyword}</span>)}</div><p>Kendine bir cümleyle açıklamayı dene.</p></section><section className="quiz-invite"><span className="small-icon"><ListChecks size={21} /></span><h3>Okudun. Peki,<br />aklında ne kaldı?</h3><p>{set.quiz.length ? `${set.quiz.length} soruluk kısa bir testle kendini yokla.` : 'Daha fazla tanım içeren bir notla test oluşturabilirsin.'}</p><button className="button dark full-width" onClick={() => setTab('quiz')}>Kendimi test edeyim <ArrowRight size={16} /></button></section></aside></div>}
      {tab === 'quiz' && <Quiz questions={set.quiz} onComplete={onComplete} />}
      {tab === 'cards' && <Flashcards cards={set.cards} />}
      {tab === 'practice' && <Practice tasks={set.practice} />}
    </div>}
    <details className="source-note"><summary><FileText size={17} /> Kaynak notunu göster <ChevronRight size={17} /></summary><pre>{note.content}</pre></details><p className="study-footnote"><LockKeyhole size={13} /> Bu çalışma seti tarayıcında hazırlanır. Seçilen cümleleri kendi ders kaynağınla birlikte değerlendir.</p>
  </div>;
}

function Quiz({ questions, onComplete }: { questions: QuizQuestion[]; onComplete: (score: number, total: number) => void }) {
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [finished, setFinished] = useState(false);
  if (!questions.length) return <div className="content-card empty-panel"><ListChecks size={34} /><h2>Bu nottan güvenilir bir test çıkaramadık.</h2><p>Birden fazla kavram ve açıklama içeren, daha ayrıntılı bir not eklemeyi dene. Özetini ve kaynak notunu yine inceleyebilirsin.</p></div>;
  const question = questions[index];
  const score = answers.reduce((sum, answer, i) => sum + Number(answer === questions[i].answerIndex), 0);
  function checkAnswer() { if (choice === null) return; setAnswers([...answers, choice]); setRevealed(true); }
  function nextQuestion() {
    if (index === questions.length - 1) { setFinished(true); onComplete(score, questions.length); }
    else { setIndex(index + 1); setChoice(null); setRevealed(false); }
  }
  function restart() { setIndex(0); setChoice(null); setAnswers([]); setRevealed(false); setFinished(false); }
  if (finished) return <section className="content-card quiz-result"><span className="result-symbol"><CheckCheck size={34} /></span><div className="eyebrow">BİR ADIM DAHA İLERİ</div><h2>{score === questions.length ? 'Konu sende!' : 'Nerede olduğunu artık biliyorsun.'}</h2><p>Her deneme, biraz daha kalıcı bir öğrenme.</p><div className="result-score"><strong>{score}<span>/{questions.length}</span></strong><span>doğru cevap</span></div><button className="button dark" onClick={restart}><RotateCcw size={16} /> Yeniden dene</button><div className="answer-review"><h3>Cevaplarına bir göz at</h3>{questions.map((q, i) => <div key={q.id} className="review-item"><span className={answers[i] === q.answerIndex ? 'answer-check correct' : 'answer-check wrong'}>{answers[i] === q.answerIndex ? <Check size={16} /> : <X size={16} />}</span><div><strong>{i + 1}. {q.options[q.answerIndex]}</strong>{answers[i] !== q.answerIndex && <small>Senin cevabın: {q.options[answers[i]]}</small>}<p>{q.explanation}</p></div></div>)}</div></section>;
  return <section className="content-card quiz-card"><div className="quiz-top"><span className="card-eyebrow"><ListChecks size={17} /> MİNİ TEST</span><span>{index + 1} / {questions.length} soru</span></div><div className="progress-track"><span style={{ width: `${((index + Number(revealed)) / questions.length) * 100}%` }} /></div><p className="quiz-instruction">Notuna bakmadan dene. Açıklamayı oku ve doğru seçeneği bul.</p><h2 className="quiz-question">{question.prompt}</h2><div className="quiz-options" role="radiogroup" aria-label="Cevap seçenekleri">{question.options.map((option, i) => <button key={i} role="radio" aria-checked={choice === i} disabled={revealed} className={`quiz-option ${choice === i ? 'selected' : ''} ${revealed && i === question.answerIndex ? 'correct' : ''} ${revealed && choice === i && i !== question.answerIndex ? 'wrong' : ''}`} onClick={() => setChoice(i)}><span className="option-letter">{'ABCD'[i]}</span><span>{option}</span>{revealed && i === question.answerIndex ? <Check size={19} /> : revealed && choice === i ? <X size={19} /> : null}</button>)}</div>{revealed && <div className={`answer-explanation ${choice === question.answerIndex ? 'is-correct' : ''}`} role="status"><strong>{choice === question.answerIndex ? 'Evet, doğru hatırladın.' : `Doğru cevap: ${question.options[question.answerIndex]}`}</strong><p>{question.explanation}</p></div>}<div className="quiz-actions"><span><LockKeyhole size={13} /> Sorular yalnızca notuna dayanır.</span>{revealed ? <button className="button dark" onClick={nextQuestion}>{index === questions.length - 1 ? 'Sonucumu gör' : 'Sıradaki soru'}<ArrowRight size={16} /></button> : <button className="button primary" disabled={choice === null} onClick={checkAnswer}>Cevabımı kontrol et <ArrowRight size={16} /></button>}</div></section>;
}

function Flashcards({ cards }: { cards: StudySet['cards'] }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  if (!cards.length) return <div className="content-card empty-panel"><BookOpen size={32} /><h2>Bu not için kart hazırlanamadı.</h2><p>Tanımlar ve açıklamalar içeren daha ayrıntılı bir not deneyebilirsin.</p></div>;
  function move(direction: number) { setIndex((index + direction + cards.length) % cards.length); setFlipped(false); }
  return <section className="flashcards"><div className="center-heading"><div className="eyebrow">ÖNCE HATIRLAMAYI DENE</div><h2>Küçük kartlar, kalıcı bilgiler.</h2><p>Cevabı düşün. Sonra kartı çevir ve kendini kontrol et.</p></div><button className={`flashcard ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(!flipped)} aria-label={flipped ? 'Kartın sorusunu göster' : 'Kartın cevabını göster'} aria-pressed={flipped}><span className="card-eyebrow">{flipped ? 'KAYNAK NOTUNDAN' : `KART ${index + 1}`}</span><span className="flashcard-text">{flipped ? cards[index].back : cards[index].front}</span><span className="flip-hint"><RotateCcw size={15} /> {flipped ? 'Soruya dön' : 'Cevabı görmek için çevir'}</span></button><div className="flashcard-controls"><button className="icon-button" onClick={() => move(-1)} aria-label="Önceki kart"><ChevronLeft size={23} /></button><span>{index + 1} / {cards.length}</span><button className="icon-button" onClick={() => move(1)} aria-label="Sonraki kart"><ChevronRight size={23} /></button></div></section>;
}

function Practice({ tasks }: { tasks: StudySet['practice'] }) {
  const [responses, setResponses] = useState<Record<string, string>>({});
  return <section className="practice-section"><div className="center-heading"><div className="eyebrow">BİLDİĞİNİ HAYATA TAŞI</div><h2>Şimdi bir de sen anlat.</h2><p>Bu alıştırmalar kendini değerlendirmek için; otomatik puanlama yapılmaz.</p></div>{tasks.map((task, index) => <article className="content-card practice-card" key={task.id}><span className="practice-number">0{index + 1}</span><h3>{task.title}</h3><p>{task.prompt}</p><label className="field"><span className="sr-only">{task.title} cevabın</span><textarea rows={4} maxLength={5000} placeholder="Kendi cümlelerinle, aklına geldiği gibi…" value={responses[task.id] ?? ''} onChange={e => setResponses({ ...responses, [task.id]: e.target.value })} /></label><details><summary><Lightbulb size={16} /> Bir ipucu al</summary><p>{task.hint}</p></details><div className="practice-checklist"><span>KENDİNİ KONTROL ET</span>{task.checklist.map((item, i) => <label key={i}><input type="checkbox" />{item}</label>)}</div></article>)}<p className="study-footnote">Alıştırma cevapları geçicidir; sekme değiştirince temizlenir.</p></section>;
}
