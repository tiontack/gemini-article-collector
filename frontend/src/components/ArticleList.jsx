import ArticleCard from './ArticleCard';
import './ArticleList.css';

export default function ArticleList({ articles, onSelect, onMarkRead, onDelete, onToggleFavorite, selectedId }) {
  if (!articles.length) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📰</div>
        <h3>아티클이 없습니다</h3>
        <p>Gemini 공유 링크를 추가하고 업데이트하거나<br />+ 아티클 추가 버튼으로 직접 입력하세요.</p>
      </div>
    );
  }

  // Group by date
  const grouped = {};
  articles.forEach(a => {
    const d = a.article_date || a.created_at?.slice(0, 10) || '날짜 없음';
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(a);
  });
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="article-list">
      {dates.map(date => (
        <div key={date} className="date-group">
          <div className="date-label">{formatDate(date)}</div>
          {grouped[date].map(a => (
            <ArticleCard
              key={a.id}
              article={a}
              selected={a.id === selectedId}
              onClick={() => onSelect(a)}
              onMarkRead={onMarkRead}
              onDelete={onDelete}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (dateStr === today.toISOString().slice(0, 10)) return '오늘';
    if (dateStr === yesterday.toISOString().slice(0, 10)) return '어제';
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
}
