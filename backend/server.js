require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { enrichArticle, parseTextForArticles } = require('./enricher');

const app = express();
const PORT = process.env.PORT || 3002;

// ── Database setup ──────────────────────────────────────────────────────────
const dbPath = process.env.DB_PATH || path.join(__dirname, 'articles.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS gemini_links (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    url         TEXT NOT NULL UNIQUE,
    label       TEXT DEFAULT '',
    last_fetched_at TEXT,
    created_at  TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS articles (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    source_link_id  INTEGER REFERENCES gemini_links(id) ON DELETE SET NULL,
    title           TEXT NOT NULL DEFAULT '(제목 없음)',
    original_url    TEXT DEFAULT '',
    summary_ko      TEXT DEFAULT '',
    notes           TEXT DEFAULT '',
    is_read         INTEGER DEFAULT 0,
    article_date    TEXT DEFAULT (date('now', 'localtime')),
    created_at      TEXT DEFAULT (datetime('now', 'localtime'))
  );
`);

// Migrations
try { db.exec('ALTER TABLE articles ADD COLUMN enriched_at TEXT'); } catch (_) {}
try { db.exec('ALTER TABLE articles ADD COLUMN is_favorite INTEGER DEFAULT 0'); } catch (_) {}

app.use(cors({ origin: '*' }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json());

// ── Articles ────────────────────────────────────────────────────────────────

app.get('/api/articles', (req, res) => {
  const { search, source_id, date, favorite } = req.query;
  let sql = `
    SELECT a.*, g.label AS source_label, g.url AS source_url
    FROM articles a
    LEFT JOIN gemini_links g ON a.source_link_id = g.id
    WHERE 1=1
  `;
  const params = [];
  if (search) {
    sql += ' AND (a.title LIKE ? OR a.summary_ko LIKE ? OR a.notes LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q, q);
  }
  if (source_id) { sql += ' AND a.source_link_id = ?'; params.push(source_id); }
  if (date)      { sql += ' AND a.article_date = ?';   params.push(date); }
  if (favorite)  { sql += ' AND a.is_favorite = 1'; }
  sql += ' ORDER BY a.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/articles/:id', (req, res) => {
  const row = db.prepare(`
    SELECT a.*, g.label AS source_label, g.url AS source_url
    FROM articles a LEFT JOIN gemini_links g ON a.source_link_id = g.id
    WHERE a.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

app.post('/api/articles', (req, res) => {
  const { title, original_url, summary_ko, notes, source_link_id, article_date } = req.body;
  const r = db.prepare(
    'INSERT INTO articles (title, original_url, summary_ko, notes, source_link_id, article_date) VALUES (?,?,?,?,?,?)'
  ).run(title || '(제목 없음)', original_url || '', summary_ko || '', notes || '', source_link_id || null, article_date || null);
  res.json({ id: r.lastInsertRowid });
});

app.put('/api/articles/:id', (req, res) => {
  const { title, original_url, summary_ko, notes, is_read, article_date } = req.body;
  db.prepare(
    'UPDATE articles SET title=?, original_url=?, summary_ko=?, notes=?, is_read=?, article_date=? WHERE id=?'
  ).run(title, original_url, summary_ko, notes, is_read ? 1 : 0, article_date, req.params.id);
  res.json({ success: true });
});

app.patch('/api/articles/:id/notes', (req, res) => {
  db.prepare('UPDATE articles SET notes=? WHERE id=?').run(req.body.notes, req.params.id);
  res.json({ success: true });
});

app.patch('/api/articles/:id/read', (req, res) => {
  db.prepare('UPDATE articles SET is_read=? WHERE id=?').run(req.body.is_read ? 1 : 0, req.params.id);
  res.json({ success: true });
});

app.patch('/api/articles/:id/favorite', (req, res) => {
  db.prepare('UPDATE articles SET is_favorite=? WHERE id=?').run(req.body.is_favorite ? 1 : 0, req.params.id);
  res.json({ success: true });
});

app.delete('/api/articles/:id', (req, res) => {
  db.prepare('DELETE FROM articles WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ── Enrich ──────────────────────────────────────────────────────────────────

app.get('/api/config', (req, res) => {
  res.json({
    hasApiKey: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_api_key_here'),
  });
});

app.post('/api/articles/:id/enrich', async (req, res) => {
  const article = db.prepare('SELECT * FROM articles WHERE id=?').get(req.params.id);
  if (!article) return res.status(404).json({ error: 'Not found' });
  if (!article.original_url) return res.status(400).json({ error: 'URL이 없는 아티클입니다.' });
  try {
    const summary_ko = await enrichArticle(article.title, article.original_url);
    db.prepare("UPDATE articles SET summary_ko=?, enriched_at=datetime('now','localtime') WHERE id=?")
      .run(summary_ko, req.params.id);
    const updated = db.prepare('SELECT * FROM articles WHERE id=?').get(req.params.id);
    res.json({ success: true, summary_ko, enriched_at: updated.enriched_at });
  } catch (e) {
    console.error('Enrich error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/parse-text', async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'text required' });
  try {
    const articles = await parseTextForArticles(text);
    res.json({ articles });
  } catch (e) {
    console.error('Parse-text error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Gemini Links ────────────────────────────────────────────────────────────

app.get('/api/links', (req, res) => {
  const rows = db.prepare(`
    SELECT g.*, (SELECT COUNT(*) FROM articles WHERE source_link_id = g.id) AS article_count
    FROM gemini_links g ORDER BY g.created_at DESC
  `).all();
  res.json(rows);
});

app.post('/api/links', (req, res) => {
  const { url, label } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });
  try {
    const r = db.prepare('INSERT INTO gemini_links (url, label) VALUES (?,?)').run(url.trim(), label || '');
    res.json({ id: r.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: '이미 등록된 링크입니다.' });
  }
});

app.put('/api/links/:id', (req, res) => {
  db.prepare('UPDATE gemini_links SET label=? WHERE id=?').run(req.body.label || '', req.params.id);
  res.json({ success: true });
});

app.delete('/api/links/:id', (req, res) => {
  db.prepare('DELETE FROM gemini_links WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ── Scraping ────────────────────────────────────────────────────────────────

const IS_MACOS = process.platform === 'darwin';
const CHROME_EXEC = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function getChromiumExec() {
  if (IS_MACOS) return CHROME_EXEC;
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  const { execFileSync } = require('child_process');
  for (const name of ['chromium', 'chromium-browser', 'google-chrome']) {
    try { return execFileSync('which', [name]).toString().trim(); } catch (_) {}
  }
  return 'chromium';
}

function fixChromeCookies(cookies) {
  return cookies.map(c => {
    const fixed = {
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || '/',
      httpOnly: !!c.httpOnly,
      secure: !!c.secure,
    };
    // Chrome stores expires as microseconds since 1601-01-01 → convert to Unix seconds
    if (c.expires && c.expires > 0) {
      const unixSecs = (c.expires / 1000000) - 11644473600;
      if (unixSecs > 0 && unixSecs < 9999999999) fixed.expires = Math.floor(unixSecs);
    }
    if (c.sameSite && ['Strict', 'Lax', 'None'].includes(c.sameSite)) {
      fixed.sameSite = c.sameSite;
    }
    return fixed;
  }).filter(c => c.name && c.value !== undefined);
}

async function getChromeGoogleCookies() {
  return new Promise((resolve, reject) => {
    try {
      const chromeCookies = require('chrome-cookies-secure');
      chromeCookies.getCookies('https://gemini.google.com/', 'puppeteer', (err, cookies) => {
        if (err) reject(err);
        else resolve(fixChromeCookies(cookies));
      });
    } catch (e) {
      reject(e);
    }
  });
}

async function scrapeGeminiShare(url) {
  // Normalize short URLs
  const targetUrl = url.replace('g.co/gemini/share/', 'gemini.google.com/share/');

  const puppeteer = require('puppeteer-core');
  const tmpDir = path.join(os.tmpdir(), 'gemini-scrape-' + Date.now());
  fs.mkdirSync(tmpDir, { recursive: true });

  let browser;
  try {
    const launchOptions = {
      executablePath: getChromiumExec(),
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
      ],
    };
    // macOS: use tmpDir + inject Chrome cookies for private Gemini links
    if (IS_MACOS) launchOptions.userDataDir = tmpDir;

    browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();

    // Inject Chrome's Google cookies for authentication (macOS only)
    if (IS_MACOS) {
      try {
        const cookies = await getChromeGoogleCookies();
        for (const c of cookies) {
          try { await page.setCookie(c); } catch (_) {}
        }
      } catch (e) {
        console.warn('Cookie injection failed:', e.message);
      }
    }

    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 5000)); // wait for SPA render

    // Extract links and surrounding text from rendered page
    const result = await page.evaluate(() => {
      const SKIP = /google|gemini|gstatic|googleapis|youtube|youtu\.be|accounts\.google/i;
      const pageText = document.body.innerText;

      const articles = [];
      const seen = new Set();

      document.querySelectorAll('a[href]').forEach(a => {
        const href = a.href;
        if (!href.startsWith('http') || SKIP.test(href) || seen.has(href)) return;
        seen.add(href);

        // Title: link text or closest heading-like parent text
        const linkText = (a.innerText || '').trim();
        const parentText = (a.closest('p, li, div')?.innerText || '').trim().slice(0, 300);
        const title = linkText.length > 5 ? linkText : (parentText.split('\n')[0] || href);

        // Summary: text around the URL in the page
        const idx = pageText.indexOf(href);
        const before = idx > 0 ? pageText.slice(Math.max(0, idx - 300), idx) : '';
        const after = pageText.slice(idx + href.length, idx + href.length + 400);
        const summary = (before.slice(-150) + ' ' + after.slice(0, 300)).trim().slice(0, 500);

        articles.push({
          url: href,
          title: title.slice(0, 200),
          summary,
        });
      });

      return articles;
    });

    return result;
  } finally {
    if (browser) await browser.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

app.post('/api/links/:id/fetch', async (req, res) => {
  const link = db.prepare('SELECT * FROM gemini_links WHERE id=?').get(req.params.id);
  if (!link) return res.status(404).json({ error: 'Link not found' });

  try {
    const scraped = await scrapeGeminiShare(link.url);
    const today = new Date().toISOString().split('T')[0];
    let addedCount = 0;

    for (const art of scraped) {
      const exists = db.prepare('SELECT id FROM articles WHERE original_url=?').get(art.url);
      if (!exists) {
        db.prepare(
          'INSERT INTO articles (source_link_id, title, original_url, summary_ko, article_date) VALUES (?,?,?,?,?)'
        ).run(link.id, art.title, art.url, art.summary, today);
        addedCount++;
      }
    }

    db.prepare("UPDATE gemini_links SET last_fetched_at=datetime('now','localtime') WHERE id=?").run(link.id);
    res.json({ success: true, total: scraped.length, added: addedCount });
  } catch (e) {
    console.error('Fetch error:', e.message);
    res.status(500).json({ error: `스크래핑 실패: ${e.message}` });
  }
});

app.post('/api/links/fetch-all', async (req, res) => {
  const links = db.prepare('SELECT * FROM gemini_links').all();
  const results = [];

  for (const link of links) {
    try {
      const scraped = await scrapeGeminiShare(link.url);
      const today = new Date().toISOString().split('T')[0];
      let added = 0;
      for (const art of scraped) {
        const exists = db.prepare('SELECT id FROM articles WHERE original_url=?').get(art.url);
        if (!exists) {
          db.prepare(
            'INSERT INTO articles (source_link_id, title, original_url, summary_ko, article_date) VALUES (?,?,?,?,?)'
          ).run(link.id, art.title, art.url, art.summary, today);
          added++;
        }
      }
      db.prepare("UPDATE gemini_links SET last_fetched_at=datetime('now','localtime') WHERE id=?").run(link.id);
      results.push({ id: link.id, label: link.label, added });
    } catch (e) {
      results.push({ id: link.id, label: link.label, error: e.message });
    }
  }

  res.json({ results });
});

// ── Stats ───────────────────────────────────────────────────────────────────

app.get('/api/stats', (req, res) => {
  const total     = db.prepare('SELECT COUNT(*) AS n FROM articles').get().n;
  const unread    = db.prepare('SELECT COUNT(*) AS n FROM articles WHERE is_read=0').get().n;
  const sources   = db.prepare('SELECT COUNT(*) AS n FROM gemini_links').get().n;
  const today     = db.prepare("SELECT COUNT(*) AS n FROM articles WHERE article_date=date('now','localtime')").get().n;
  const favorites = db.prepare('SELECT COUNT(*) AS n FROM articles WHERE is_favorite=1').get().n;
  res.json({ total, unread, sources, today, favorites });
});

app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
