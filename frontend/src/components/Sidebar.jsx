import { useState } from 'react';
import axios from 'axios';
import './Sidebar.css';

const API = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

export default function Sidebar({
  links, stats, filterSource, setFilterSource,
  filterFavorite, setFilterFavorite,
  onFetchOne, onFetchAll, fetching, onLinksChange, showToast,
}) {
  const [showAdd, setShowAdd]   = useState(false);
  const [newUrl, setNewUrl]     = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [editId, setEditId]     = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [adding, setAdding]     = useState(false);

  const handleAddLink = async () => {
    if (!newUrl.trim()) return;
    setAdding(true);
    try {
      await axios.post(`${API}/links`, { url: newUrl.trim(), label: newLabel.trim() });
      setNewUrl(''); setNewLabel(''); setShowAdd(false);
      onLinksChange();
      showToast('링크 추가됨');
    } catch (e) {
      showToast(e.response?.data?.error || '링크 추가 실패', 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteLink = async (id) => {
    if (!confirm('이 링크와 연결된 기록을 삭제할까요?')) return;
    await axios.delete(`${API}/links/${id}`);
    if (filterSource === String(id)) setFilterSource('');
    onLinksChange();
    showToast('삭제됨');
  };

  const handleSaveLabel = async (id) => {
    await axios.put(`${API}/links/${id}`, { label: editLabel });
    setEditId(null);
    onLinksChange();
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-icon">✦</span>
        <span>Article Collector</span>
      </div>

      {/* Fetch controls */}
      <div className="sidebar-section">
        <button
          className="btn-fetch-all"
          onClick={onFetchAll}
          disabled={fetching}
        >
          {fetching ? '가져오는 중...' : '⟳ 전체 업데이트'}
        </button>
      </div>

      {/* Filter by source */}
      <div className="sidebar-section">
        <div className="section-title">보기</div>
        <div
          className={`filter-item ${!filterFavorite && filterSource === '' ? 'active' : ''}`}
          onClick={() => { setFilterSource(''); setFilterFavorite(false); }}
        >
          <span>전체 아티클</span>
          <span className="count-badge">{stats.total || 0}</span>
        </div>
        <div
          className={`filter-item filter-favorite ${filterFavorite ? 'active' : ''}`}
          onClick={() => { setFilterFavorite(true); setFilterSource(''); }}
        >
          <span>⭐ 즐겨찾기</span>
          {stats.favorites > 0 && <span className="count-badge">{stats.favorites}</span>}
        </div>
      </div>

      {/* Filter by source */}
      <div className="sidebar-section">
        <div className="section-title">소스 필터</div>
        {links.map(l => (
          <div
            key={l.id}
            className={`filter-item ${!filterFavorite && filterSource === String(l.id) ? 'active' : ''}`}
            onClick={() => { setFilterSource(String(l.id)); setFilterFavorite(false); }}
          >
            <span className="link-label">{l.label || '링크 ' + l.id}</span>
            <span className="count-badge">{l.article_count}</span>
          </div>
        ))}
      </div>

      {/* Link manager */}
      <div className="sidebar-section sidebar-links">
        <div className="section-title-row">
          <span className="section-title">Gemini 링크</span>
          <button className="btn-add-link" onClick={() => setShowAdd(v => !v)}>+</button>
        </div>

        {showAdd && (
          <div className="add-link-form">
            <input
              placeholder="Gemini 공유 링크 URL"
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddLink()}
            />
            <input
              placeholder="이름 (선택)"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              style={{ marginTop: 6 }}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button className="btn-primary btn-sm" onClick={handleAddLink} disabled={adding}>
                {adding ? '추가 중...' : '추가'}
              </button>
              <button className="btn-ghost btn-sm" onClick={() => { setShowAdd(false); setNewUrl(''); setNewLabel(''); }}>
                취소
              </button>
            </div>
          </div>
        )}

        <div className="link-list">
          {links.map(l => (
            <div key={l.id} className="link-card">
              {editId === l.id ? (
                <div className="link-edit">
                  <input value={editLabel} onChange={e => setEditLabel(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveLabel(l.id)} autoFocus />
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    <button className="btn-primary btn-sm" onClick={() => handleSaveLabel(l.id)}>저장</button>
                    <button className="btn-ghost btn-sm" onClick={() => setEditId(null)}>취소</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="link-info">
                    <span className="link-name">{l.label || '(이름 없음)'}</span>
                    <a href={l.url} target="_blank" rel="noreferrer" className="link-url">
                      {l.url.slice(0, 36)}{l.url.length > 36 ? '…' : ''}
                    </a>
                    {l.last_fetched_at && (
                      <span className="link-fetched">마지막 업데이트: {l.last_fetched_at.slice(0, 16)}</span>
                    )}
                  </div>
                  <div className="link-actions">
                    <button
                      className="icon-btn"
                      title="지금 가져오기"
                      onClick={() => onFetchOne(l.id)}
                      disabled={fetching}
                    >⟳</button>
                    <button
                      className="icon-btn"
                      title="이름 편집"
                      onClick={() => { setEditId(l.id); setEditLabel(l.label || ''); }}
                    >✎</button>
                    <button
                      className="icon-btn icon-danger"
                      title="삭제"
                      onClick={() => handleDeleteLink(l.id)}
                    >✕</button>
                  </div>
                </>
              )}
            </div>
          ))}
          {!links.length && (
            <p className="empty-hint">아직 등록된 링크가 없습니다.<br />+ 버튼으로 Gemini 공유 링크를 추가하세요.</p>
          )}
        </div>
      </div>
    </aside>
  );
}
