import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Sidebar from './components/Sidebar';
import ArticleList from './components/ArticleList';
import ArticleModal from './components/ArticleModal';
import AddArticleModal from './components/AddArticleModal';
import TextInputModal from './components/TextInputModal';
import './App.css';

const API = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

export default function App() {
  const [articles, setArticles]     = useState([]);
  const [links, setLinks]           = useState([]);
  const [stats, setStats]           = useState({});
  const [selected, setSelected]     = useState(null);
  const [showAdd, setShowAdd]       = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [hasApiKey, setHasApiKey]   = useState(false);
  const [filterSource, setFilterSource]   = useState('');
  const [filterFavorite, setFilterFavorite] = useState(false);
  const [filterDate, setFilterDate]       = useState('');
  const [search, setSearch]             = useState('');
  const [fetching, setFetching]         = useState(false);
  const [toast, setToast]               = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadAll = useCallback(async () => {
    try {
      const params = {};
      if (search)         params.search    = search;
      if (filterSource)   params.source_id = filterSource;
      if (filterDate)     params.date      = filterDate;
      if (filterFavorite) params.favorite  = 1;

      const [artRes, linkRes, statRes] = await Promise.all([
        axios.get(`${API}/articles`, { params }),
        axios.get(`${API}/links`),
        axios.get(`${API}/stats`),
      ]);
      setArticles(artRes.data);
      setLinks(linkRes.data);
      setStats(statRes.data);
    } catch (e) {
      showToast('데이터 로드 실패', 'error');
    }
  }, [search, filterSource, filterDate, filterFavorite]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    fetch(`${API}/config`).then(r => r.json()).then(d => setHasApiKey(!!d.hasApiKey)).catch(() => {});
  }, []);

  const handleFetchAll = async () => {
    if (!links.length) { showToast('등록된 Gemini 링크가 없습니다.', 'error'); return; }
    setFetching(true);
    try {
      const { data } = await axios.post(`${API}/links/fetch-all`);
      const added = data.results.reduce((s, r) => s + (r.added || 0), 0);
      showToast(`${added}개 아티클 추가됨`);
      loadAll();
    } catch (e) {
      showToast('가져오기 실패', 'error');
    } finally {
      setFetching(false);
    }
  };

  const handleFetchOne = async (linkId) => {
    setFetching(true);
    try {
      const { data } = await axios.post(`${API}/links/${linkId}/fetch`);
      showToast(`${data.added}개 아티클 추가됨`);
      loadAll();
    } catch (e) {
      showToast(e.response?.data?.error || '가져오기 실패', 'error');
    } finally {
      setFetching(false);
    }
  };

  const handleSaveNotes = async (id, notes) => {
    await axios.patch(`${API}/articles/${id}/notes`, { notes });
    setArticles(prev => prev.map(a => a.id === id ? { ...a, notes } : a));
  };

  const handleMarkRead = async (id, is_read) => {
    await axios.patch(`${API}/articles/${id}/read`, { is_read });
    setArticles(prev => prev.map(a => a.id === id ? { ...a, is_read: is_read ? 1 : 0 } : a));
    loadAll(); // update stats
  };

  const handleToggleFavorite = async (id, is_favorite) => {
    await axios.patch(`${API}/articles/${id}/favorite`, { is_favorite });
    setArticles(prev => prev.map(a => a.id === id ? { ...a, is_favorite: is_favorite ? 1 : 0 } : a));
    loadAll(); // update stats
  };

  const handleDeleteArticle = async (id) => {
    if (!confirm('이 아티클을 삭제할까요?')) return;
    await axios.delete(`${API}/articles/${id}`);
    setArticles(prev => prev.filter(a => a.id !== id));
    if (selected?.id === id) setSelected(null);
    showToast('삭제됨');
    loadAll();
  };

  const handleSaveArticle = async (data) => {
    if (data.id) {
      await axios.put(`${API}/articles/${data.id}`, data);
      showToast('수정됨');
    } else {
      await axios.post(`${API}/articles`, data);
      showToast('아티클 추가됨');
    }
    setShowAdd(false);
    loadAll();
  };

  const handleArticleClick = (article) => setSelected(article);

  return (
    <div className="app-layout">
      <Sidebar
        links={links}
        stats={stats}
        filterSource={filterSource}
        setFilterSource={setFilterSource}
        filterFavorite={filterFavorite}
        setFilterFavorite={setFilterFavorite}
        onFetchOne={handleFetchOne}
        onFetchAll={handleFetchAll}
        fetching={fetching}
        onLinksChange={loadAll}
        showToast={showToast}
      />

      <main className="main-area">
        <header className="main-header">
          <div className="header-left">
            <h1 className="app-title">
              <span className="title-icon">✦</span> Gemini 아티클
            </h1>
            <div className="stats-row">
              <span className="badge badge-blue">전체 {stats.total || 0}</span>
              <span className="badge badge-gray">미읽음 {stats.unread || 0}</span>
              <span className="badge badge-green">오늘 {stats.today || 0}</span>
            </div>
          </div>
          <div className="header-right">
            {hasApiKey && (
              <button className="btn-ghost" onClick={() => setShowTextInput(true)}>
                📝 텍스트로 추가
              </button>
            )}
            <button className="btn-primary" onClick={() => setShowAdd(true)}>+ 아티클 추가</button>
          </div>
        </header>

        <div className="filter-bar">
          <input
            className="search-input"
            placeholder="검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            style={{ width: 160 }}
          />
          {(search || filterDate || filterSource || filterFavorite) && (
            <button className="btn-ghost btn-sm" onClick={() => {
              setSearch(''); setFilterDate(''); setFilterSource(''); setFilterFavorite(false);
            }}>
              필터 초기화
            </button>
          )}
        </div>

        <ArticleList
          articles={articles}
          onSelect={handleArticleClick}
          onMarkRead={handleMarkRead}
          onDelete={handleDeleteArticle}
          onToggleFavorite={handleToggleFavorite}
          selectedId={selected?.id}
        />
      </main>

      {selected && (
        <ArticleModal
          article={selected}
          onClose={() => setSelected(null)}
          onSaveNotes={handleSaveNotes}
          onMarkRead={handleMarkRead}
          onDelete={handleDeleteArticle}
          onToggleFavorite={handleToggleFavorite}
          hasApiKey={hasApiKey}
        />
      )}

      {showAdd && (
        <AddArticleModal
          links={links}
          initial={selected}
          onSave={handleSaveArticle}
          onClose={() => setShowAdd(false)}
        />
      )}

      {showTextInput && (
        <TextInputModal
          links={links}
          onSave={() => { showToast('아티클 저장됨'); loadAll(); }}
          onClose={() => setShowTextInput(false)}
        />
      )}

      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  );
}
