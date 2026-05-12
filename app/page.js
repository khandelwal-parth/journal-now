'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

export default function JournalPage() {
  const [entries, setEntries] = useState({});
  const [currentKey, setCurrentKey] = useState(null);
  const [view, setView] = useState('welcome');
  const [statusState, setStatusState] = useState('saved');
  const [statusMsg, setStatusMsg] = useState('ready');
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [autoSave, setAutoSave] = useState(false);
  const [search, setSearch] = useState('');
  const [calVisible, setCalVisible] = useState(false);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calDayEntries, setCalDayEntries] = useState(null);
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiReply, setAiReply] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const aiInputRef = useRef(null);
  const editorRef = useRef(null);
  const saveTimerRef = useRef(null);

  function today() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function stripHtml(h) { return (h || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim(); }
  function wc(h) { const t = stripHtml(h); return t ? t.split(/\s+/).filter(Boolean).length : 0; }
  function fmtLong(iso) {
    try {
      const dt = iso.includes('T') ? new Date(iso) : new Date(iso + 'T00:00:00');
      const dp = dt.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      return iso.includes('T') ? dp + ' · ' + dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : dp;
    } catch { return iso; }
  }
  function fmtShort(iso) {
    try {
      const dt = iso.includes('T') ? new Date(iso) : new Date(iso + 'T00:00:00');
      const dp = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return iso.includes('T') ? dp + ' ' + dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : dp;
    } catch { return iso; }
  }

  // Auth check — runs once
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => {
        if (!r.ok) {
          window.location.replace('/login');
          return null;
        }
        return r.json();
      })
      .then(d => {
        if (d) {
          setUser(d);
          setAuthChecked(true);
          // Load entries
          try {
            const cached = localStorage.getItem('journal_cache');
            if (cached) setEntries(JSON.parse(cached));
          } catch (e) { }
          fetch('/api/entries')
            .then(r => r.json())
            .then(d => {
              setEntries(d || {});
              try { localStorage.setItem('journal_cache', JSON.stringify(d || {})); } catch (e) { }
            })
            .catch(() => { });
        }
      })
      .catch(() => {
        window.location.replace('/login');
      });
  }, []);

  const saveEntry = useCallback(async (auto = false) => {
    if (!currentKey || !editorRef.current) return;
    const html = editorRef.current.innerHTML;
    setEntries(prev => ({ ...prev, [currentKey]: { ...prev[currentKey], html, updated: new Date().toISOString() } }));
    setStatusState('saved');
    setStatusMsg(auto ? 'auto-saved' : 'saved ✓');
    fetch('/api/entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entry_key: currentKey, html }) });
  }, [currentKey]);

  function deleteEntryByKey(key) {
    if (!confirm('Delete this entry forever?')) return;
    setEntries(prev => { const n = { ...prev }; delete n[key]; return n; });
    if (currentKey === key) { setCurrentKey(null); setView('welcome'); }
    fetch('/api/entries', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entry_key: key }) });
  }

  function openEntry(key) {
    setCurrentKey(key);
    setView('editor');
    setStatusState('saved');
    setStatusMsg('ready');
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = entries[key]?.html || '';
        editorRef.current.focus();
        updateCounts();
      }
    }, 0);
  }

  function openToday() {
    const t = today();
    const key = Object.keys(entries).find(k => k === t) || t;
    if (!entries[key]) {
      setEntries(prev => ({ ...prev, [key]: { html: '', created: new Date().toISOString() } }));
      fetch('/api/entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entry_key: key, html: '' }) });
    }
    openEntry(key);
  }

  function createNewEntry() {
    const now = new Date();
    const key = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0') + 'T' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ':' + String(now.getSeconds()).padStart(2, '0');
    setEntries(prev => ({ ...prev, [key]: { html: '', created: now.toISOString() } }));
    fetch('/api/entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entry_key: key, html: '' }) });
    openEntry(key);
  }

  function updateCounts() {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    setWordCount(wc(html));
    setCharCount(stripHtml(html).length);
  }

  function handleEditorInput() {
    updateCounts();
    setStatusState('unsaved');
    setStatusMsg('');
    clearTimeout(saveTimerRef.current);
    if (autoSave) saveTimerRef.current = setTimeout(() => saveEntry(true), 2000);
  }

  function fmt(cmd, val) { editorRef.current?.focus(); document.execCommand(cmd, false, val || null); }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.replace('/login');
  }

  async function askAI() {
    const q = aiQuery.trim();
    if (!q || aiLoading) return;
    setAiLoading(true);
    setAiReply('');
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, currentEntryKey: currentKey }),
      });
      const data = await res.json();
      setAiReply(data.reply || 'no response');
    } catch {
      setAiReply('something went wrong, try again.');
    } finally {
      setAiLoading(false);
      setAiQuery('');
    }
  }

  function exportEntry() {
    if (!currentKey) return;
    const text = stripHtml(entries[currentKey]?.html || '');
    const blob = new Blob([fmtLong(currentKey) + '\n\n' + text], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'journal-' + currentKey + '.txt'; a.click();
  }

  // Keyboard shortcuts — single listener
  useEffect(() => {
    function onKey(e) {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === 's') { e.preventDefault(); saveEntry(); }
      if (ctrl && e.key === 'b') { e.preventDefault(); fmt('bold'); }
      if (ctrl && e.key === 'i') { e.preventDefault(); fmt('italic'); }
      if (ctrl && e.key === 'u') { e.preventDefault(); fmt('underline'); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveEntry]);

  function handlePaste(e) {
    const items = Array.from(e.clipboardData.items).filter(i => i.type.startsWith('image/'));
    if (!items.length) return;
    e.preventDefault();
    items.forEach(item => {
      const reader = new FileReader();
      reader.onload = ev => {
        const img = document.createElement('img');
        img.src = ev.target.result;
        img.style.cssText = 'max-width:100%;border-radius:10px;margin:16px 0;display:block';
        const sel = window.getSelection();
        if (sel?.rangeCount) { const r = sel.getRangeAt(0); r.deleteContents(); r.insertNode(img); } else editorRef.current?.appendChild(img);
      };
      reader.readAsDataURL(item.getAsFile());
    });
  }

  function renderCalendarGrid() {
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const todayStr = today();
    const entryDates = {};
    Object.keys(entries).forEach(k => { const d = k.slice(0, 10); if (!entryDates[d]) entryDates[d] = []; entryDates[d].push(k); });
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(<div key={`b${i}`} />);
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = calYear + '-' + String(calMonth + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      const has = !!entryDates[ds];
      const isTod = ds === todayStr;
      cells.push(
        <div key={ds} onClick={() => has && setCalDayEntries({ date: ds, keys: entryDates[ds] })}
          style={{ aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, fontSize: 11, fontFamily: "'DM Mono',monospace", cursor: has ? 'pointer' : 'default', background: has ? '#e8c88a' : 'transparent', color: has ? '#7c5c3a' : '#8a7a68', fontWeight: has ? 700 : 400, outline: isTod ? '2px solid #c49a5a' : 'none', outlineOffset: -1 }}>{d}</div>
      );
    }
    return { cells, monthLabel: MONTHS[calMonth] + ' ' + calYear };
  }

  const { cells: calCells, monthLabel } = renderCalendarGrid();
  const allKeys = Object.keys(entries).sort((a, b) => b.localeCompare(a));
  const filteredKeys = search ? allKeys.filter(k => stripHtml(entries[k]?.html || '').toLowerCase().includes(search.toLowerCase()) || k.includes(search)) : allKeys;
  const isToday = currentKey?.startsWith(today());

  // Don't render until auth is checked
  if (!authChecked) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#faf7f2', fontFamily: "'Instrument Sans',sans-serif", color: '#a08c78', fontSize: 14 }}>loading...</div>;

  const S = {
    sidebarBtn: { width: '100%', padding: '11px 16px', background: '#7c5c3a', color: '#fff', border: 'none', borderRadius: 8, fontFamily: "'Instrument Sans',sans-serif", fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 8 },
    newBtn: { width: '100%', padding: '9px 16px', background: 'transparent', color: '#7c5c3a', border: '1.5px dashed #c49a5a', borderRadius: 8, fontFamily: "'Instrument Sans',sans-serif", fontSize: 13, cursor: 'pointer' },
    fmtBtn: { padding: '5px 9px', border: 'none', background: 'transparent', borderRadius: 4, cursor: 'pointer', fontSize: 13, color: '#6b5c4a', minWidth: 30 },
    sep: { width: 1, height: 18, background: '#e8e0d4', margin: '0 3px' },
    topBtn: { padding: '7px 10px', border: '1px solid #e8e0d4', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#7c5c3a', fontSize: 13, fontFamily: "'Instrument Sans',sans-serif" },
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: "'Instrument Sans',sans-serif", color: '#1a1410' }}>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=DM+Mono:wght@400;500&family=Instrument+Sans:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        html,body{height:100%;background:#faf7f2;overflow:hidden}
        #editor:empty:before{content:attr(data-placeholder);color:#c8b8a4;font-style:italic;pointer-events:none}
        #editor img{max-width:100%;border-radius:10px;margin:16px 0;display:block}
        #editor blockquote{border-left:3px solid #c49a5a;padding-left:20px;color:#7a6a58;font-style:italic;margin:12px 0}
        #editor h1{font-family:'Lora',serif;font-size:28px;font-weight:600;margin:16px 0 8px;color:#7c5c3a}
        #editor h2{font-family:'Lora',serif;font-size:22px;font-weight:600;margin:14px 0 6px;color:#7c5c3a}
        #editor ul,#editor ol{padding-left:24px;margin:8px 0}
        #editor li{margin:4px 0}
        #editor a{color:#c49a5a;text-decoration:underline}
        #editor hr{border:none;border-top:1px solid #e8e0d4;margin:20px 0}
        .entry-item:hover{background:#e8e0d4 !important}
        .entry-item:hover .del-x{opacity:1 !important;pointer-events:all !important}
        .fmt-btn:hover{background:#e8e0d4 !important}
        button:hover{opacity:0.9}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#e8e0d4;border-radius:2px}
      `}</style>

      {/* SIDEBAR */}
      <div style={{ width: 280, minWidth: 280, background: '#f2ede4', borderRight: '1px solid #e8e0d4', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid #e8e0d4' }}>
          <div style={{ fontFamily: "'Lora',serif", fontSize: 22, fontStyle: 'italic', color: '#7c5c3a', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#c49a5a' }} /> my journal.
          </div>
          {user && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#a08c78', marginBottom: 14 }}>hey, {user.name} 👋</div>}
          <button onClick={openToday} style={S.sidebarBtn}>✦ write for today</button>
          <button onClick={createNewEntry} style={S.newBtn}>+ new entry</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid #e8e0d4', background: '#faf7f2' }}>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#a08c78' }}>⚡ auto-save</span>
          <div onClick={() => setAutoSave(p => !p)} style={{ width: 36, height: 20, borderRadius: 20, background: autoSave ? '#c49a5a' : '#e8e0d4', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
            <div style={{ position: 'absolute', width: 14, height: 14, borderRadius: '50%', background: '#fff', top: 3, left: autoSave ? 19 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
          </div>
        </div>

        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8e0d4' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.4, fontSize: 13, pointerEvents: 'none' }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="search your entries..." style={{ width: '100%', padding: '8px 12px 8px 30px', background: '#faf7f2', border: '1px solid #e8e0d4', borderRadius: 6, fontFamily: "'Instrument Sans',sans-serif", fontSize: 13, color: '#1a1410', outline: 'none' }} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 6px' }}>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#a08c78', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{filteredKeys.length} {filteredKeys.length === 1 ? 'entry' : 'entries'}</span>
          <button onClick={() => { setCalVisible(p => !p); setCalDayEntries(null); }} style={{ background: 'transparent', border: '1px solid #e8e0d4', borderRadius: 5, padding: '3px 6px', cursor: 'pointer', fontSize: 13 }}>📅</button>
        </div>

        {calVisible && (
          <div style={{ background: '#faf7f2', borderBottom: '1px solid #e8e0d4', padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <button onClick={() => { setCalMonth(m => { if (m === 0) { setCalYear(y => y - 1); return 11; } return m - 1; }); setCalDayEntries(null); }} style={{ background: 'none', border: 'none', fontSize: 18, color: '#7c5c3a', cursor: 'pointer' }}>‹</button>
              <span style={{ fontFamily: "'Lora',serif", fontSize: 13, fontStyle: 'italic', color: '#7c5c3a', fontWeight: 600 }}>{monthLabel}</span>
              <button onClick={() => { setCalMonth(m => { if (m === 11) { setCalYear(y => y + 1); return 0; } return m + 1; }); setCalDayEntries(null); }} style={{ background: 'none', border: 'none', fontSize: 18, color: '#7c5c3a', cursor: 'pointer' }}>›</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', textAlign: 'center', fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#b8a490', marginBottom: 4 }}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <span key={d}>{d}</span>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>{calCells}</div>
            {calDayEntries && (
              <div style={{ marginTop: 10, maxHeight: 120, overflowY: 'auto' }}>
                {calDayEntries.keys.sort().map(k => (
                  <div key={k} onClick={() => { openEntry(k); setCalVisible(false); setCalDayEntries(null); }}
                    style={{ padding: '6px 8px', borderRadius: 6, cursor: 'pointer', border: '1px solid #e8e0d4', marginBottom: 4, background: '#f2ede4' }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#7c5c3a', marginBottom: 2 }}>{k.includes('T') ? new Date(k).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'all day'}</div>
                    <div style={{ fontSize: 11, color: '#7a6a58', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{stripHtml(entries[k]?.html || '').slice(0, 60) || '(empty)'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 16px' }}>
          {filteredKeys.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#b8a490', fontSize: 13, lineHeight: 1.8 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{search ? '🔍' : '✏️'}</div>
              {search ? 'no entries match' : 'no saved entries yet.\nstart writing!'}
            </div>
          ) : filteredKeys.map(k => (
            <div key={k} className="entry-item" onClick={() => openEntry(k)}
              style={{ padding: '12px 14px', borderRadius: 8, cursor: 'pointer', marginBottom: 3, border: `1.5px solid ${currentKey === k ? '#c49a5a' : 'transparent'}`, background: currentKey === k ? '#faf7f2' : 'transparent', position: 'relative', transition: 'background 0.15s' }}>
              <button className="del-x" onClick={e => { e.stopPropagation(); deleteEntryByKey(k); }}
                style={{ position: 'absolute', top: 7, right: 8, width: 22, height: 22, borderRadius: '50%', background: '#fef0ef', border: '1px solid #f5c0bc', color: '#c0392b', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, pointerEvents: 'none', transition: 'opacity 0.15s', zIndex: 2 }}>✕</button>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#7c5c3a', fontWeight: 500 }}>{fmtShort(k)}</div>
                {k.startsWith(today()) && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, background: '#e8c88a', color: '#7c5c3a', padding: '2px 6px', borderRadius: 3 }}>today</span>}
              </div>
              <div style={{ fontSize: 12, color: '#7a6a58', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stripHtml(entries[k]?.html || '').slice(0, 65) || '(empty)'}</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#b8a490', marginTop: 5 }}>{wc(entries[k]?.html || '')} words{entries[k]?.updated ? ' · ' + new Date(entries[k].updated).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid #e8e0d4' }}>
          <button onClick={logout} style={{ width: '100%', padding: 8, background: 'transparent', border: '1px solid #e8e0d4', borderRadius: 6, fontFamily: "'Instrument Sans',sans-serif", fontSize: 12, color: '#a08c78', cursor: 'pointer' }}>sign out</button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#faf7f2' }}>
        {view === 'welcome' ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 20, opacity: 0.8 }}>📖</div>
            <div style={{ fontFamily: "'Lora',serif", fontSize: 32, fontStyle: 'italic', color: '#7c5c3a', marginBottom: 10 }}>your journal awaits</div>
            <div style={{ fontSize: 15, lineHeight: 1.7, color: '#8a7a68', marginBottom: 32, maxWidth: 400 }}>A quiet space to write freely, paste images, and keep your thoughts — one day at a time.</div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
              {['📷 paste images', '✍️ rich formatting', '💾 auto-save', '🔍 search entries'].map(f => (
                <span key={f} style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, background: '#f2ede4', color: '#7c5c3a', padding: '6px 14px', borderRadius: 20, border: '1px solid #e8e0d4' }}>{f}</span>
              ))}
            </div>
            <button onClick={openToday} style={{ padding: '14px 36px', background: '#7c5c3a', color: '#fff', border: 'none', borderRadius: 8, fontFamily: "'Instrument Sans',sans-serif", fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>✦ start writing for today</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 28px 12px', borderBottom: '1px solid #e8e0d4', background: '#faf7f2', minHeight: 58 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontFamily: "'Lora',serif", fontSize: 18, fontStyle: 'italic', color: '#7c5c3a' }}>{currentKey ? fmtLong(currentKey) : '—'}</div>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, background: '#f2ede4', color: '#c49a5a', padding: '3px 9px', borderRadius: 4, border: '1px solid #e8e0d4' }}>{isToday ? 'today' : 'past entry'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true; inp.onchange = e => Array.from(e.target.files).forEach(f => { const r = new FileReader(); r.onload = ev => { const img = document.createElement('img'); img.src = ev.target.result; img.style.cssText = 'max-width:100%;border-radius:10px;margin:16px 0;display:block'; editorRef.current?.appendChild(img); }; r.readAsDataURL(f); }); inp.click(); }} style={S.topBtn}>📷 image</button>
                <button onClick={exportEntry} style={S.topBtn}>↓ export</button>
                {!isToday && <button onClick={() => deleteEntryByKey(currentKey)} style={{ padding: '7px 14px', background: '#fef0ef', color: '#c0392b', border: '1px solid #f5c0bc', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: "'Instrument Sans',sans-serif" }}>🗑 delete</button>}
                <button onClick={() => saveEntry()} style={{ padding: '7px 20px', background: statusState === 'saved' ? '#2e7d32' : '#7c5c3a', color: '#fff', border: 'none', borderRadius: 6, fontFamily: "'Instrument Sans',sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}>{statusState === 'saved' ? 'saved ✓' : 'save'}</button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2, padding: '7px 28px', borderBottom: '1px solid #e8e0d4', background: '#f2ede4' }}>
              {[['bold', 'B', { fontWeight: 700 }], ['italic', 'I', { fontStyle: 'italic' }], ['underline', 'U', { textDecoration: 'underline' }], ['strikeThrough', 'S', { textDecoration: 'line-through' }]].map(([cmd, label, st]) => (
                <button key={cmd} className="fmt-btn" onClick={() => fmt(cmd)} style={{ ...S.fmtBtn, ...st }}>{label}</button>
              ))}
              <div style={S.sep} />
              <button className="fmt-btn" onClick={() => fmt('formatBlock', 'h1')} style={{ ...S.fmtBtn, fontWeight: 700, fontSize: 14 }}>H1</button>
              <button className="fmt-btn" onClick={() => fmt('formatBlock', 'h2')} style={{ ...S.fmtBtn, fontWeight: 600, fontSize: 12 }}>H2</button>
              <div style={S.sep} />
              <button className="fmt-btn" onClick={() => fmt('insertUnorderedList')} style={S.fmtBtn}>• list</button>
              <button className="fmt-btn" onClick={() => fmt('insertOrderedList')} style={S.fmtBtn}>1. list</button>
              <button className="fmt-btn" onClick={() => fmt('formatBlock', 'blockquote')} style={S.fmtBtn}>&quot; quote</button>
              <button className="fmt-btn" onClick={() => document.execCommand('insertHorizontalRule', false, null)} style={S.fmtBtn}>── hr</button>
              <div style={S.sep} />
              <select onChange={e => { if (e.target.value) fmt('fontSize', e.target.value); e.target.value = ''; }} defaultValue="" style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, border: '1px solid #e8e0d4', borderRadius: 4, padding: '3px 5px', background: '#faf7f2', color: '#1a1410', cursor: 'pointer' }}>
                <option value="">size</option>
                <option value="1">small</option>
                <option value="3">normal</option>
                <option value="4">large</option>
                <option value="5">xl</option>
              </select>
              <div style={S.sep} />
              <input type="color" defaultValue="#7c5c3a" onChange={e => fmt('foreColor', e.target.value)} style={{ width: 22, height: 22, border: '1px solid #e8e0d4', borderRadius: 4, cursor: 'pointer', padding: 1, background: 'transparent' }} />
              <div style={S.sep} />
              <button className="fmt-btn" onClick={() => fmt('removeFormat')} style={{ ...S.fmtBtn, fontSize: 11, color: '#a08c78' }}>clear</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '40px 52px', display: 'flex', flexDirection: 'column', background: '#faf7f2' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#b8a490', background: '#f2ede4', border: '1px dashed #e8e0d4', padding: '7px 14px', borderRadius: 5, maxWidth: 720, margin: '0 auto 20px', width: '100%', lineHeight: 1.6 }}>
                💡 tip: paste images with Ctrl+V · drag & drop · Ctrl+S to save
              </div>
              <div id="editor" ref={editorRef} contentEditable suppressContentEditableWarning data-placeholder="let your thoughts flow freely... this is your space." onInput={handleEditorInput} onPaste={handlePaste} spellCheck
                style={{ minHeight: 'calc(100vh - 280px)', fontFamily: "'Lora',serif", fontSize: 18, lineHeight: 1.9, color: '#1a1410', outline: 'none', maxWidth: 720, margin: '0 auto', width: '100%', caretColor: '#7c5c3a' }} />
            </div>

            {/* AI BAR */}
            <div style={{ borderTop: '1px solid #e8e0d4', background: '#f2ede4', flexShrink: 0 }}>

              {/* Toggle strip */}
              <div
                onClick={() => { setAiOpen(p => !p); setTimeout(() => aiInputRef.current?.focus(), 50); }}
                style={{ padding: '6px 52px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', borderBottom: aiOpen ? '1px solid #e8e0d4' : 'none' }}
              >
                <span style={{ fontSize: 13 }}>✦</span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#a08c78' }}>
                  ask your journal anything
                </span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#c49a5a', marginLeft: 'auto' }}>
                  {aiOpen ? '▾' : '▸'}
                </span>
              </div>

              {/* Expanded AI panel */}
              {aiOpen && (
                <div style={{ padding: '14px 52px 16px' }}>

                  {/* Reply bubble */}
                  {(aiReply || aiLoading) && (
                    <div style={{
                      background: '#faf7f2', border: '1px solid #e8e0d4', borderRadius: 10,
                      padding: '12px 16px', marginBottom: 12, maxWidth: 680,
                      fontFamily: "'Lora',serif", fontSize: 15, lineHeight: 1.75, color: '#3a2e24',
                      fontStyle: 'italic',
                    }}>
                      {aiLoading ? (
                        <span style={{ color: '#b8a490', fontFamily: "'DM Mono',monospace", fontSize: 12, fontStyle: 'normal', animation: 'pulse 1.5s infinite', display: 'inline-block' }}>
                          thinking...
                        </span>
                      ) : aiReply}
                    </div>
                  )}

                  {/* Input row */}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', maxWidth: 680 }}>
                    <input
                      ref={aiInputRef}
                      value={aiQuery}
                      onChange={e => setAiQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && askAI()}
                      placeholder="how have i been feeling lately? what am i avoiding? ..."
                      disabled={aiLoading}
                      style={{
                        flex: 1, padding: '9px 14px',
                        background: '#fff', border: '1px solid #e8e0d4', borderRadius: 7,
                        fontFamily: "'Instrument Sans',sans-serif", fontSize: 13, color: '#1a1410',
                        outline: 'none',
                      }}
                    />
                    <button
                      onClick={askAI}
                      disabled={aiLoading || !aiQuery.trim()}
                      style={{
                        padding: '9px 18px', background: aiLoading ? '#c49a5a' : '#7c5c3a',
                        color: '#fff', border: 'none', borderRadius: 7,
                        fontFamily: "'Instrument Sans',sans-serif", fontSize: 13, fontWeight: 600,
                        cursor: aiLoading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                        opacity: (!aiQuery.trim() && !aiLoading) ? 0.5 : 1,
                      }}
                    >
                      {aiLoading ? '...' : 'ask →'}
                    </button>
                  </div>
                </div>
              )}

              {/* Original status bar — always visible */}
              <div style={{ padding: '6px 52px 7px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#a08c78', borderTop: aiOpen ? '1px solid #e8e0d4' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusState === 'saved' ? '#2e7d32' : '#c49a5a', display: 'inline-block', animation: statusState === 'unsaved' ? 'pulse 1.5s infinite' : 'none' }} />
                  <span>{statusMsg || (statusState === 'saved' ? 'saved' : 'unsaved changes')}</span>
                </div>
                <div>{wordCount} words · {charCount} chars · {Math.max(1, Math.ceil(wordCount / 200))} min read</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}