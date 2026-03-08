import { useState } from 'react';
import './TextInputModal.css';

export default function TextInputModal({ links, onSave, onClose }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [sourceId, setSourceId] = useState('');
  const [error, setError] = useState('');

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleAnalyze = async () => {
    if (!text.trim()) { setError('텍스트를 입력하세요.'); return; }
    setError('');
    setLoading(true);
    setResults(null);
    setSelected(new Set());
    try {
      const res = await fetch('/api/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '분석 실패');
      setResults(data.articles);
      setSelected(new Set(data.articles.map((_, i) => i)));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (i) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const handleSave = async () => {
    const toSave = results.filter((_, i) => selected.has(i));
    if (!toSave.length) { setError('저장할 아티클을 선택하세요.'); return; }
    const today = new Date().toISOString().slice(0, 10);
    for (const art of toSave) {
      await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: art.title,
          original_url: art.url || '',
          summary_ko: art.summary_ko || art.description || '',
          source_link_id: sourceId || null,
          article_date: today,
        }),
      });
    }
    onSave();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal tim-modal">
        <div className="modal-header">
          <h2>텍스트로 아티클 추가</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {!results && (
            <>
              <div className="section">
                <div className="field-label">Gemini 대화 내용 붙여넣기</div>
                <textarea
                  className="tim-textarea"
                  placeholder="Gemini가 공유해준 아티클 목록, 뉴스레터, 또는 아티클이 언급된 텍스트를 붙여넣으세요..."
                  rows={12}
                  value={text}
                  onChange={e => setText(e.target.value)}
                />
              </div>
              <div className="section">
                <div className="field-label">소스 링크 (선택)</div>
                <select value={sourceId} onChange={e => setSourceId(e.target.value)}>
                  <option value="">-- 선택 안함 --</option>
                  {links.map(l => (
                    <option key={l.id} value={l.id}>{l.label || l.url.slice(0, 40)}</option>
                  ))}
                </select>
              </div>
              {error && <div className="tim-error">{error}</div>}
            </>
          )}

          {loading && (
            <div className="tim-loading">
              <div className="tim-spinner" />
              <p>AI가 아티클을 분석하고 한국어로 정리 중입니다...<br/><small>아티클 수에 따라 1~3분 소요될 수 있습니다.</small></p>
            </div>
          )}

          {results && !loading && (
            <div className="tim-results">
              <div className="tim-results-header">
                <span>{results.length}개 아티클 발견</span>
                <div className="tim-select-btns">
                  <button className="btn-ghost btn-sm" onClick={() => setSelected(new Set(results.map((_, i) => i)))}>전체 선택</button>
                  <button className="btn-ghost btn-sm" onClick={() => setSelected(new Set())}>전체 해제</button>
                </div>
              </div>
              {results.map((art, i) => (
                <div
                  key={i}
                  className={`tim-article-item ${selected.has(i) ? 'selected' : ''}`}
                  onClick={() => toggleSelect(i)}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    onChange={() => toggleSelect(i)}
                    onClick={e => e.stopPropagation()}
                  />
                  <div className="tim-article-info">
                    <div className="tim-article-title">{art.title}</div>
                    {art.url && <div className="tim-article-url">{art.url}</div>}
                    {art.source && <div className="tim-article-source">출처: {art.source}</div>}
                    {art.summary_ko && (
                      <div className="tim-article-summary">{art.summary_ko.slice(0, 200)}{art.summary_ko.length > 200 ? '...' : ''}</div>
                    )}
                  </div>
                </div>
              ))}
              {error && <div className="tim-error">{error}</div>}
            </div>
          )}
        </div>

        <div className="modal-footer">
          {!results ? (
            <>
              <button className="btn-ghost" onClick={onClose}>취소</button>
              <button className="btn-primary" onClick={handleAnalyze} disabled={loading}>
                {loading ? '분석 중...' : '🔍 분석하기'}
              </button>
            </>
          ) : (
            <>
              <button className="btn-ghost" onClick={() => { setResults(null); setError(''); }}>← 다시 입력</button>
              <button className="btn-primary" onClick={handleSave} disabled={selected.size === 0}>
                선택한 {selected.size}개 저장
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
