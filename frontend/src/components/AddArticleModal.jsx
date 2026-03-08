import { useState, useEffect } from 'react';

export default function AddArticleModal({ links, initial, onSave, onClose }) {
  const [form, setForm] = useState({
    id: null,
    title: '',
    original_url: '',
    summary_ko: '',
    notes: '',
    source_link_id: '',
    article_date: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    if (initial) {
      setForm({
        id: initial.id,
        title: initial.title || '',
        original_url: initial.original_url || '',
        summary_ko: initial.summary_ko || '',
        notes: initial.notes || '',
        source_link_id: initial.source_link_id || '',
        article_date: initial.article_date || new Date().toISOString().slice(0, 10),
      });
    }
  }, [initial?.id]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (!form.title.trim()) { alert('제목을 입력하세요.'); return; }
    onSave(form);
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal">
        <div className="modal-header">
          <h2>{form.id ? '아티클 수정' : '아티클 직접 추가'}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="section">
            <div className="field-label">제목 *</div>
            <input
              placeholder="아티클 제목"
              value={form.title}
              onChange={e => set('title', e.target.value)}
            />
          </div>
          <div className="section">
            <div className="field-label">원문 링크</div>
            <input
              placeholder="https://..."
              value={form.original_url}
              onChange={e => set('original_url', e.target.value)}
            />
          </div>
          <div className="section">
            <div className="field-label">요약 / 한국어 번역</div>
            <textarea
              placeholder="Gemini가 제공한 요약 또는 번역본을 입력하세요..."
              rows={6}
              value={form.summary_ko}
              onChange={e => set('summary_ko', e.target.value)}
            />
          </div>
          <div className="section">
            <div className="field-label">내 메모</div>
            <textarea
              placeholder="메모 (선택)"
              rows={3}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="section" style={{ flex: 1 }}>
              <div className="field-label">날짜</div>
              <input
                type="date"
                value={form.article_date}
                onChange={e => set('article_date', e.target.value)}
              />
            </div>
            <div className="section" style={{ flex: 1 }}>
              <div className="field-label">소스 링크</div>
              <select
                value={form.source_link_id}
                onChange={e => set('source_link_id', e.target.value)}
              >
                <option value="">-- 선택 안함 --</option>
                {links.map(l => (
                  <option key={l.id} value={l.id}>{l.label || l.url.slice(0, 40)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>취소</button>
          <button className="btn-primary" onClick={handleSubmit}>
            {form.id ? '수정 저장' : '추가'}
          </button>
        </div>
      </div>
    </div>
  );
}
