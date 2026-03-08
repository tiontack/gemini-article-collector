import { useState, useEffect, useRef } from 'react';
import './ArticleModal.css';

export default function ArticleModal({ article: initialArticle, onClose, onSaveNotes, onMarkRead, onDelete, onToggleFavorite, hasApiKey }) {
  const [article, setArticle] = useState(initialArticle);
  const [notes, setNotes] = useState(initialArticle.notes || '');
  const [saved, setSaved]  = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    setArticle(initialArticle);
    setNotes(initialArticle.notes || '');
    setSaved(true);
    setEnrichError('');
  }, [initialArticle.id]);

  const handleNotesChange = (val) => {
    setNotes(val);
    setSaved(false);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      await onSaveNotes(article.id, val);
      setSaved(true);
    }, 800);
  };

  const handleEnrich = async () => {
    setEnriching(true);
    setEnrichError('');
    try {
      const res = await fetch(`/api/articles/${article.id}/enrich`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '보강 실패');
      setArticle(a => ({ ...a, summary_ko: data.summary_ko, enriched_at: data.enriched_at }));
    } catch (e) {
      setEnrichError(e.message);
    } finally {
      setEnriching(false);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal article-modal">
        <div className="modal-header">
          <div style={{ flex: 1 }}>
            <div className="article-modal-meta">
              {article.source_label && (
                <span className="badge badge-blue">{article.source_label}</span>
              )}
              {article.article_date && (
                <span className="badge badge-gray">{article.article_date}</span>
              )}
              <span className={`badge ${article.is_read ? 'badge-gray' : 'badge-green'}`}>
                {article.is_read ? '읽음' : '미읽음'}
              </span>
              {article.enriched_at && (
                <span className="badge badge-purple">AI 보강됨</span>
              )}
            </div>
            <h2 style={{ marginTop: 8 }}>{article.title}</h2>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Original link + enrich button */}
          {article.original_url && (
            <div className="section">
              <div className="field-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>원문 링크</span>
                {hasApiKey && (
                  <button
                    className="btn-enrich"
                    onClick={handleEnrich}
                    disabled={enriching}
                    title="AI가 원문을 읽고 상세 한국어 요약을 생성합니다"
                  >
                    {enriching ? '⏳ 분석 중...' : '🔍 내용 보강'}
                  </button>
                )}
              </div>
              <a
                href={article.original_url}
                target="_blank"
                rel="noreferrer"
                className="original-link"
              >
                {article.original_url} ↗
              </a>
              {enrichError && <div className="enrich-error">{enrichError}</div>}
              {enriching && (
                <div className="enrich-loading">AI가 원문을 읽고 한국어로 정리 중입니다...</div>
              )}
            </div>
          )}

          {/* Korean summary */}
          {article.summary_ko && (
            <div className="section">
              <div className="field-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>요약 / 번역 (한국어)</span>
                {article.enriched_at && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>AI 보강: {article.enriched_at}</span>
                )}
              </div>
              <div className="summary-box">{article.summary_ko}</div>
            </div>
          )}

          {/* Notes */}
          <div className="section">
            <div className="field-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>내 메모</span>
              <span className="save-indicator">{saved ? '✓ 저장됨' : '저장 중...'}</span>
            </div>
            <textarea
              className="notes-textarea"
              placeholder="이 아티클에 대한 메모를 입력하세요..."
              value={notes}
              onChange={e => handleNotesChange(e.target.value)}
              rows={6}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button
            className={`btn-ghost btn-favorite ${article.is_favorite ? 'is-favorited' : ''}`}
            onClick={() => {
              const next = !article.is_favorite;
              onToggleFavorite(article.id, next);
              setArticle(a => ({ ...a, is_favorite: next ? 1 : 0 }));
            }}
            title={article.is_favorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
          >
            {article.is_favorite ? '★ 즐겨찾기 해제' : '☆ 즐겨찾기'}
          </button>
          <button
            className="btn-ghost"
            onClick={() => onMarkRead(article.id, !article.is_read)}
          >
            {article.is_read ? '미읽음으로 표시' : '읽음으로 표시'}
          </button>
          <button
            className="btn-danger btn-sm"
            onClick={() => { onDelete(article.id); onClose(); }}
          >
            삭제
          </button>
          <button className="btn-primary" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
