import React, { useEffect, useMemo, useState } from 'react';

import { useRef } from 'react';

const API = `${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api`;

function App() {
  const [token, setToken] = useState(localStorage.getItem('psm_token') || '');
  const [email, setEmail] = useState(
  localStorage.getItem('psm_email') || ''
);
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const [tab, setTab] = useState('dashboard');
  const [file, setFile] = useState(null);
  const [pastedText, setPastedText] = useState('');
  const [documentName, setDocumentName] = useState('Pasted text.txt');
  const [referenceFile, setReferenceFile] = useState(null);
  const [references, setReferences] = useState([]);
  const [history, setHistory] = useState([]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [activeMatch, setActiveMatch] = useState(0);
  const highlightedTextRef = useRef(null);
  const [reportOnly, setReportOnly] = useState(false);

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  async function request(path, options = {}) {
    const res = await fetch(`${API}${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) },
    });
    const type = res.headers.get('content-type') || '';
    if (!res.ok) {
      let detail = `Request failed (${res.status})`;
      try {
        const body = await res.json();
        detail = body.detail || detail;
      } catch {}
      throw new Error(detail);
    }
    if (type.includes('application/pdf')) return res.blob();
    return res.json();
  }

  async function loadLists() {
    try {
      const [h, r] = await Promise.all([request('/scans'), request('/references')]);
      setHistory(h);
      setReferences(r);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    if (token) loadLists();
  }, [token]);
  useEffect(() => { if (tab !== 'scan') setReportOnly(false); }, [tab]);


async function authenticate(e) {
  e.preventDefault();
  setError('');
  setBusy(true);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let response;
    try {
      response = await fetch(
        `${API}/auth/${authMode === 'login' ? 'login' : 'register'}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          signal: controller.signal,
        }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.detail || 'Authentication failed.');
    }

    localStorage.setItem('psm_token', body.token);
    localStorage.setItem('psm_email', body.email || email);
    setToken(body.token);
    setEmail(body.email || email);
  } catch (e) {
    setError(
      e.name === 'AbortError'
        ? 'The server did not respond within 15 seconds. Check that the backend is running.'
        : e.message || 'Unable to sign in.'
    );
  } finally {
    setBusy(false);
  }
}


  function logout() {
    localStorage.removeItem('psm_token');
    localStorage.removeItem('psm_email');
    setToken('');
    setResult(null);
    setHistory([]);
    setReferences([]);
    setTab('dashboard');
  }

  async function scan(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      let data;
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        data = await request('/scans', { method: 'POST', body: fd });
      } else {
        if (!pastedText.trim()) throw new Error('Choose a document or paste text before scanning.');
        data = await request('/scans/text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: pastedText, document_name: documentName || 'Pasted text.txt' }),
        });
      }
      setResult(data);
      setActiveMatch(0);
      setMessage('Scan completed and saved to history.');
      await loadLists();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function addReference(e) {
    e.preventDefault();
    if (!referenceFile) return;
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', referenceFile);
      const response = await request('/references', { method: 'POST', body: fd });
      setMessage(`${response.message} (${response.word_count} words)`);
      setReferenceFile(null);
      e.target.reset();
      await loadLists();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function openReport(id) {
    setError('');
    setBusy(true);
    try {
      setResult(await request(`/scans/${id}`));
      setTab('scan');
      setReportOnly(true);
      setActiveMatch(0);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteScan(id) {
    if (!window.confirm('Delete this scan and its report?')) return;
    try {
      await request(`/scans/${id}`, { method: 'DELETE' });
      if (result?.id === id) setResult(null);
      await loadLists();
      setMessage('Scan report deleted.');
    } catch (e) {
      setError(e.message);
    }
  }

  async function deleteReference(id) {
    if (!window.confirm('Delete this reference document?')) return;
    try {
      await request(`/references/${id}`, { method: 'DELETE' });
      await loadLists();
      setMessage('Reference deleted.');
    } catch (e) {
      setError(e.message);
    }
  }

  async function downloadPdf() {
    if (!result?.id) return;
    try {
      const blob = await request(`/scans/${result.id}/pdf`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `psm-report-${result.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    }
  }

  function highlightedText(text, matches) {
    if (!matches?.length) return text;
    const spans = [...matches].sort((a, b) => a.start_char - b.start_char);
    const chunks = [];
    let cursor = 0;
    spans.forEach((match, i) => {
      if (match.start_char < cursor) return;
      if (match.start_char > cursor) {
        chunks.push(<span key={`t${i}`}>{text.slice(cursor, match.start_char)}</span>);
      }
      chunks.push(
  <mark
    key={`m${i}`}
    data-match-index={matches.indexOf(match)}
    className={`${match.category} ${
      activeMatch === matches.indexOf(match) ? "selected-match" : ""
    }`}
    title={`${match.category}: ${match.source_name}`}
  >
    {text.slice(match.start_char, match.end_char)}
  </mark>
);
      cursor = match.end_char;
    });
    if (cursor < text.length) chunks.push(<span key="tail">{text.slice(cursor)}</span>);
    return chunks;
  }

  const averageSimilarity = history.length
    ? (history.reduce((sum, item) => sum + Number(item.similarity_score || 0), 0) / history.length).toFixed(1)
    : '0.0';
  const flaggedCount = history.filter(item => Number(item.similarity_score) >= 20).length;
  const latestScans = history.slice(0, 5);



if (!token) {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-icon" aria-hidden="true">
          <svg viewBox="0 0 48 48" fill="none">
            <path
              d="M13 5.5H28L37 14.5V37A4 4 0 0 1 33 41H13A4 4 0 0 1 9 37V9.5A4 4 0 0 1 13 5.5Z"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <path
              d="M28 6V15H37M15 22H29M15 28H25"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle
              cx="30"
              cy="31"
              r="6"
              fill="#E8E5FF"
              stroke="currentColor"
              strokeWidth="2.5"
            />
            <path
              d="M34.5 35.5L39 40"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <h1 className="auth-title">Plagiarism Detector</h1>
        <p className="auth-description">
          Compare documents, identify matching passages, and
          review source evidence in one workspace.
        </p>

        <div className="auth-divider" />

        
<div className="auth-welcome-box">
  <h2 className="auth-welcome">
    {authMode === 'login' ? 'Welcome!' : 'Get started today'}
  </h2>
  <p className="auth-subtitle">
    {authMode === 'login'
      ? 'Sign in to access your plagiarism detection workspace.'
      : 'Create your account to start checking document similarity.'}
  </p>
</div>


        <form onSubmit={authenticate} className="stack auth-form">
          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength="8"
              placeholder="Enter your password"
            />
          </label>

          {error && <div className="alert error">{error}</div>}

          <button
            className="primary auth-submit"
            disabled={busy}
            type="submit"
          >
            {busy
              ? 'Please wait...'
              : authMode === 'login'
                 ? 'Sign in to your workspace →'
                : 'Create my account →'}
          </button>
        </form>

        <p className="switch-auth">
          {authMode === 'login'
            ? 'Don’t have an account?'
            : 'Already have an account?'}{' '}
          <button
            type="button"
            className="link"
            onClick={() => {
              setAuthMode(authMode === 'login' ? 'register' : 'login');
              setError('');
            }}
          >
            {authMode === 'login' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}



  const pageTitles = {
    dashboard: 'Overview',
    scan: 'New document scan',
    history: 'Scan history',
    references: 'Reference library',
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-mark small">PSM</div>
          <div><strong>PSM Insight</strong><small>Document intelligence</small></div>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <button className={`nav-item ${tab === 'dashboard' ? 'selected' : ''}`} onClick={() => setTab('dashboard')}><span className="nav-symbol">⌂</span><span>Overview</span></button>
        <button className={`nav-item ${tab === 'scan' ? 'selected' : ''}`} onClick={() => { setTab('scan'); setReportOnly(false); }}><span className="nav-symbol">⌕</span><span>New scan</span></button>
        <button className={`nav-item ${tab === 'history' ? 'selected' : ''}`} onClick={() => setTab('history')}><span className="nav-symbol">◷</span><span>Scan history</span></button>
        <button className={`nav-item ${tab === 'references' ? 'selected' : ''}`} onClick={() => setTab('references')}><span className="nav-symbol">▤</span><span>Reference library</span></button>
        
        <div className="sidebar-bottom">
          <div className="user-chip">
            <div className="avatar">{email?.[0]?.toUpperCase() || 'U'}</div>
            <div className="user-info"><strong>{email || 'Signed in'}</strong><small>Personal workspace</small></div>
          </div>
          <button className="nav-item" onClick={logout}><span className="nav-symbol">↪</span><span>Sign out</span></button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div><p className="eyebrow">PSM INSIGHT / WORKSPACE</p><h1>{tab === 'scan' && reportOnly ? 'Scan report' : pageTitles[tab]}</h1></div>
          <div className="topbar-actions">
            <div className="top-status"><span className="status-dot"></span> Internal reference matching</div>
            <button className="top-new-scan" onClick={() => { setTab('scan'); setError(''); setReportOnly(false); }}>+ New scan</button>
          </div>
        </header>

        {error && <div className="alert error">{error}<button onClick={() => setError('')}>x</button></div>}
        {message && <div className="alert success">{message}<button onClick={() => setMessage('')}>x</button></div>}

        {tab === 'dashboard' && (
          <div className="dashboard-page">
            <section className="welcome-banner">
              <div className="welcome-copy">
                <span className="welcome-kicker"><span className="welcome-spark">*</span> DOCUMENT INTELLIGENCE</span>
                <h2>Understand what's in your documents.</h2>
                <p>Compare submissions with your reference library, inspect matching passages, and keep every report organized.</p>
                <button className="welcome-cta" onClick={() => { setTab('scan'); setResult(null); setReportOnly(false); }}>Start a new scan <span>→</span></button>
              </div>
              <div className="welcome-art" aria-hidden="true">
                <div className="art-orbit orbit-one"></div><div className="art-orbit orbit-two"></div>
                <div className="art-document"><div className="art-doc-head"><span></span><span></span><span></span></div><i></i><i></i><i className="short"></i><div className="art-highlight"></div><i></i><i className="medium"></i><i className="short"></i></div>
                <div className="art-badge"><span>*</span><div><strong>Match found</strong><small>Source evidence ready</small></div></div>
              </div>
            </section>

            <div className="dashboard-section-head"><div><h2>Workspace overview</h2><p>A quick view of your document analysis activity.</p></div><span className="live-label"><span></span> UPDATED LIVE</span></div>
            <section className="dashboard-stats">
              <div className="dashboard-stat"><div className="stat-top"><span>Total scans</span><span className="stat-icon purple">⌕</span></div><strong>{history.length}</strong><small>Reports in your history</small><div className="stat-bottom"><span className="stat-mini-bar purple-bar"></span><span>All time</span></div></div>
              <div className="dashboard-stat"><div className="stat-top"><span>Average similarity</span><span className="stat-icon cyan">◉</span></div><strong>{averageSimilarity}<em>%</em></strong><small>Across saved reports</small><div className="stat-bottom"><span className="stat-mini-bar cyan-bar"></span><span>All time</span></div></div>
              <div className="dashboard-stat"><div className="stat-top"><span>Flagged reports</span><span className="stat-icon amber">!</span></div><strong>{flaggedCount}</strong><small>Reports at or above 20%</small><div className="stat-bottom"><span className="stat-mini-bar amber-bar"></span><span>Review recommended</span></div></div>
              <div className="dashboard-stat"><div className="stat-top"><span>Reference sources</span><span className="stat-icon green">▤</span></div><strong>{references.length}</strong><small>Available for comparison</small><div className="stat-bottom"><span className="stat-mini-bar green-bar"></span><span>Internal library</span></div></div>
            </section>

            <section className="dashboard-lower">
              <div className="panel recent-panel">
                <div className="panel-heading"><div><h2>Recent scans</h2><p>Open a previous report or continue your review.</p></div><button className="text-action" onClick={() => setTab('history')}>View all <span>→</span></button></div>
                {latestScans.length === 0 ? (
                  <div className="dashboard-empty"><div className="dashboard-empty-icon">Search</div><strong>Your first report starts here</strong><p>Run a scan to compare a document against your reference library.</p><button className="primary" onClick={() => { setTab('scan'); setReportOnly(false); }}>Start first scan →</button></div>
                ) : (
                  <div className="recent-list">
                    {latestScans.map(item => (
                      <div className="recent-row" key={item.id}>
                        <div className="recent-file-icon">▤</div>
                        <div className="recent-file-info"><strong>{item.document_name}</strong><small>Report #{item.id} | {new Date(item.created_at).toLocaleDateString()}</small></div>
                        <div className="recent-score"><strong>{Number(item.similarity_score).toFixed(1)}%</strong><small>similarity</small></div>
                        <button className="recent-open" onClick={() => openReport(item.id)}>Open <span>→</span></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="panel quick-panel">
                <div className="panel-heading"><div><h2>Quick actions</h2><p>Pick up where you left off.</p></div></div>
                <button className="quick-action" onClick={() => { setTab('scan'); setReportOnly(false); }}><span className="quick-action-icon violet">⌕</span><span><strong>Analyze a document</strong><small>Upload a PDF, DOCX, or TXT</small></span><b>→</b></button>
                <button className="quick-action" onClick={() => setTab('references')}><span className="quick-action-icon teal">▤</span><span><strong>Manage reference library</strong><small>Add or remove comparison sources</small></span><b>→</b></button>
                <button className="quick-action" onClick={() => setTab('history')}><span className="quick-action-icon gold">◷</span><span><strong>Browse scan history</strong><small>Reopen saved reports</small></span><b>→</b></button>
                <div className="quick-note"><span>i</span><p>Results compare documents in your internal library. Similarity is a review signal, not a final plagiarism verdict.</p></div>
              </div>
            </section>
          </div>
        )}

        {tab === 'scan' && (
          <div className={`content-grid ${reportOnly ? 'report-only' : ''}`}>
            <section className="panel scan-panel">
              <div className="panel-heading"><div><h2>Check a document</h2><p>Upload a file or paste text to compare it with your reference library.</p></div><span className="step-pill">STEP 01</span></div>
              <form onSubmit={scan} className="stack">
                <label>Document name<input value={documentName} onChange={e => setDocumentName(e.target.value)} placeholder="e.g. research-paper.txt" /></label>

<label className="upload-zone">
  <input
    type="file"
    accept=".pdf,.docx,.txt,application/pdf,text/plain"
    onChange={e => {
      const selectedFile = e.target.files?.[0] || null;
      setFile(selectedFile);

      if (selectedFile) {
        setPastedText('');
        setDocumentName(selectedFile.name);
      }
    }}
  />
  <span className="upload-icon">Upload</span>
  <strong>{file ? file.name : 'Choose a document to upload'}</strong>
  <small>PDF, DOCX, or TXT | maximum 10 MB</small>
</label>
                <div className="separator"><span>OR PASTE TEXT</span></div>
                <label>Submitted text<textarea rows="9" value={pastedText} onChange={e => { setPastedText(e.target.value); if (e.target.value) setFile(null); }} placeholder="Paste your content here. Sentences are compared with the reference documents..." /></label>
                <div className="form-foot"><span className="muted">{pastedText.trim() ? pastedText.trim().split(/\s+/).length : file ? 'File ready' : 'No text entered'} {pastedText.trim() ? 'words' : ''}</span><button className="primary" disabled={busy}>{busy ? 'Analyzing...' : 'Run similarity scan →'}</button></div>
              </form>
              <div className="method-note"><strong>How it works</strong><p>Exact and near-duplicate matches are checked against documents in the internal reference library. Semantic matching can be enabled on the backend.</p></div>
            </section>
            <section className="results-column">
              {!result ? <div className="empty-result panel"><div className="empty-icon">Search</div><h2>Your results will appear here</h2><p>Run a scan to see similarity score, matched passages, and source details.</p><div className="empty-stats"><div><strong>01</strong><span>Upload</span></div><div><strong>02</strong><span>Compare</span></div><div><strong>03</strong><span>Review</span></div></div></div> :
                <div className="panel result-panel">
                  <div className="panel-heading"><div><p className="eyebrow">SCAN REPORT #{result.id}</p><h2>{result.document_name}</h2><p>{new Date(result.created_at).toLocaleString()}</p></div><div className="heading-actions">{reportOnly && <button className="ghost" onClick={() => setTab('history')}>← Back to history</button>}<button className="secondary" onClick={downloadPdf}>Export PDF</button></div></div>
                  <div className="score-grid"><div className="score-card"><span>Similarity score</span><strong>{Number(result.similarity_score).toFixed(1)}<small>%</small></strong><div className="meter"><span style={{ width: `${result.similarity_score}%` }} /></div></div><div className="mini-stat"><span>Document words</span><strong>{result.word_count}</strong></div><div className="mini-stat"><span>Matched words</span><strong>{result.matched_word_count}</strong></div><div className="mini-stat"><span>Passages</span><strong>{result.match_count}</strong></div></div>
                  <div className="legend"><span><i className="exact-dot" /> Exact</span><span><i className="near-dot" /> Near-duplicate</span><span><i className="semantic-dot" /> Semantic</span></div>
                  <h3 className="section-title">Submitted text <span>{result.matches.length} matches</span></h3>
<div className="highlighted-text" ref={highlightedTextRef}>
  {highlightedText(result.text, result.matches)}
</div>
                  <h3 className="section-title">Matched passages</h3>
                  {result.matches.length === 0 ? <div className="no-matches">No matches found in the current reference library.</div> :
                    <div className="match-list">{result.matches.map((m, i) => <button key={m.id || i} className={`match-card ${activeMatch === i ? 'active' : ''}`} onClick={() => {
  setActiveMatch(i);
  const target = highlightedTextRef.current?.querySelector(
    `[data-match-index="${i}"]`
  );
  target?.scrollIntoView({ behavior: "smooth", block: "center" });
}}>
                      <div className="match-card-top"><span className={`category-tag ${m.category}`}>{m.category}</span><span className="match-percent">{m.similarity}% match</span></div>
                      <p className="match-excerpt">"{m.submitted_excerpt}"</p><div className="source-line"><span>Source</span><strong>{m.source_name}</strong></div><p className="source-excerpt">{m.source_excerpt}</p>
                    </button>)}</div>}
                  <p className="disclaimer">Similarity is an indicator, not definitive proof of plagiarism. Results depend on the documents available in the reference library.</p>
                </div>}
            </section>
          </div>
        )}

        {tab === 'history' && (
          <section className="panel">
            <div className="panel-heading"><div><h2>Previous scans</h2><p>Reopen or delete a saved report.</p></div><span className="count-pill">{history.length} reports</span></div>
            {history.length === 0 ? <div className="empty-state">No scans yet. Run your first scan to see it here.</div> :
              <div className="table-wrap"><table><thead><tr><th>Document</th><th>Date</th><th>Words</th><th>Similarity</th><th>Matches</th><th>Actions</th></tr></thead><tbody>{history.map(h => <tr key={h.id}><td><strong>{h.document_name}</strong><small>Report #{h.id}</small></td><td>{new Date(h.created_at).toLocaleString()}</td><td>{h.word_count}</td><td><span className="score-chip">{h.similarity_score}%</span></td><td>{h.match_count}</td><td><button className="table-action" onClick={() => openReport(h.id)}>Open</button><button className="table-action danger-text" onClick={() => deleteScan(h.id)}>Delete</button></td></tr>)}</tbody></table></div>}
          </section>
        )}

        {tab === 'references' && (
          <div className="content-grid reference-grid">
            <section className="panel">
              <div className="panel-heading"><div><h2>Add reference document</h2><p>Build your internal comparison source library.</p></div></div>
              <form onSubmit={addReference} className="stack">
                <label className="upload-zone"><input type="file" accept=".pdf,.docx,.txt" onChange={e => setReferenceFile(e.target.files[0] || null)} /><span className="upload-icon">+</span><strong>{referenceFile ? referenceFile.name : 'Choose a reference document'}</strong><small>PDF, DOCX, or TXT | maximum 10 MB</small></label>
                <button className="primary" disabled={busy || !referenceFile}>{busy ? 'Adding...' : 'Add to reference library'}</button>
              </form>
              <div className="method-note"><strong>Tip</strong><p>Add known source documents before running a scan. This version compares against your internal collection; it does not search the whole internet.</p></div>
            </section>
            <section className="panel">
              <div className="panel-heading"><div><h2>Reference library</h2><p>Documents available for matching.</p></div><span className="count-pill">{references.length} sources</span></div>
              {references.length === 0 ? <div className="empty-state">Your library is empty. Add a reference document to enable matching.</div> :
                <div className="reference-list">{references.map(r => <div className="reference-item" key={r.id}><div className="file-icon">▤</div><div className="reference-meta"><strong>{r.name}</strong><small>{r.word_count} words | Added {new Date(r.created_at).toLocaleDateString()}</small></div><button className="table-action danger-text" onClick={() => deleteReference(r.id)}>Delete</button></div>)}</div>}
            </section>
          </div>
        )}
        <footer>PSM Insight <span>Document similarity analysis for review - not a verdict.</span></footer>
      </main>
    </div>
  );
}

export default App;