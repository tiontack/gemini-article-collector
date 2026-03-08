import './ArticleCard.css';

export default function ArticleCard({ article, selected, onClick, onMarkRead, onDelete, onToggleFavorite }) {
  const a = article;

  return (
    <div
      className={`article-card ${selected ? 'selected' : ''} ${a.is_read ? 'read' : 'unread'}`}
      onClick={onClick}
    >
      <div className="card-left">
        <button
          className={`read-dot ${a.is_read ? 'is-read' : ''}`}
          title={a.is_read ? '읽음 취소' : '읽음 표시'}
          onClick={e => { e.stopPropagation(); onMarkRead(a.id, !a.is_read); }}
        />
      </div>

      <div className="card-body">
        <div className="card-title">{a.title}</div>
        {a.summary_ko && (
          <div className="card-summary">{a.summary_ko.slice(0, 120)}{a.summary_ko.length > 120 ? '…' : ''}</div>
        )}
        <div className="card-meta">
          {a.source_label && <span className="meta-source">{a.source_label}</span>}
          {a.original_url && (
            <a
              href={a.original_url}
              target="_blank"
              rel="noreferrer"
              className="meta-link"
              onClick={e => e.stopPropagation()}
            >
              원문 보기 ↗
            </a>
          )}
          {a.notes && <span className="meta-notes">📝 메모 있음</span>}
        </div>
      </div>

      <div className="card-actions" onClick={e => e.stopPropagation()}>
        <button
          className={`card-star ${a.is_favorite ? 'starred' : ''}`}
          title={a.is_favorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
          onClick={() => onToggleFavorite(a.id, !a.is_favorite)}
        >{a.is_favorite ? '★' : '☆'}</button>
        <button
          className="card-delete"
          title="삭제"
          onClick={() => onDelete(a.id)}
        >✕</button>
      </div>
    </div>
  );
}
