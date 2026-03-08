const axios = require('axios');
const cheerio = require('cheerio');
const { GoogleGenAI } = require('@google/genai');

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
};

function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'your_api_key_here') {
    throw new Error('GEMINI_API_KEY가 설정되지 않았습니다. backend/.env 파일에 키를 입력해주세요.');
  }
  return new GoogleGenAI({ apiKey: key });
}

// ── Web content extraction ──────────────────────────────────────────────────

async function fetchPageContent(url) {
  try {
    const { data: html } = await axios.get(url, {
      headers: FETCH_HEADERS,
      timeout: 12000,
      maxRedirects: 5,
    });

    const $ = cheerio.load(html);

    // Remove noise
    $('script, style, nav, footer, header, aside, .sidebar, .ad, .ads, .advertisement, .cookie, .popup, .modal, .menu, .navigation, .comments, .related').remove();

    // Find main content using semantic selectors (priority order)
    const candidates = [
      'article',
      'main',
      '[role="main"]',
      '.article-body', '.article-content', '.post-content', '.entry-content',
      '.content', '#content', '#main-content', '.main-content',
      '.story-body', '.body-content', '.text-content',
    ];

    let text = '';
    for (const sel of candidates) {
      const el = $(sel).first();
      if (el.length && el.text().trim().length > 300) {
        text = el.text();
        break;
      }
    }

    if (!text || text.trim().length < 100) {
      text = $('body').text();
    }

    return text
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, 6000);
  } catch (e) {
    return `[페이지 로드 실패: ${e.message}]`;
  }
}

// ── Single article enrichment ───────────────────────────────────────────────

async function enrichArticle(title, url) {
  const ai = getClient();
  const content = await fetchPageContent(url);

  const prompt = `당신은 HR/학습개발(L&D) 분야의 전문 콘텐츠 큐레이터입니다.
아래 아티클의 본문을 바탕으로 한국어 상세 정리본을 작성해주세요.

제목: ${title}
URL: ${url}

본문 내용:
${content}

---
아래 형식으로 작성하세요 (이 지시 자체는 포함하지 말 것):

## 📋 핵심 요약
(3~4문장으로 아티클의 핵심 메시지 요약)

## 🔑 주요 인사이트
- 핵심 포인트 1
- 핵심 포인트 2
- 핵심 포인트 3
(최대 5개, 구체적 수치나 사례 포함)

## 💡 HR/L&D 실무 적용
(담당자가 즉시 활용할 수 있는 방법 2~3가지)

## 📌 핵심 개념
(이 아티클에서 이해해야 할 중요 개념 1~2개와 간단한 설명)`;

  const result = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
  return result.text;
}

// ── Parse free text for article references ─────────────────────────────────

async function parseTextForArticles(userText) {
  const ai = getClient();

  // Step 1: Extract article references
  const extractResult = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `다음 텍스트에서 언급된 아티클, 보고서, 연구, 책, 영상 등의 참조 자료를 모두 추출해주세요.

텍스트:
${userText}

JSON 배열만 반환하세요 (설명 없이):
[
  {
    "title": "자료 제목",
    "url": "URL (없으면 null)",
    "source": "출처 기관 또는 저자",
    "description": "내용 설명 (100자 이내)"
  }
]`,
  });

  let articles = [];
  try {
    const text = extractResult.text;
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) articles = JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error('아티클 목록 파싱 실패: ' + e.message);
  }

  if (!articles.length) return [];

  // Step 2: Enrich each article in parallel
  const enriched = await Promise.allSettled(
    articles.map(async (art) => {
      if (art.url) {
        try {
          const summary_ko = await enrichArticle(art.title, art.url);
          return { ...art, summary_ko };
        } catch (e) {
          return { ...art, summary_ko: art.description || `[내용 분석 실패: ${e.message}]` };
        }
      }
      try {
        const res = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `다음 자료에 대해 HR/L&D 전문가 관점에서 한국어로 상세히 설명해주세요.\n제목: ${art.title}\n출처: ${art.source || '미상'}\n설명: ${art.description || ''}`,
        });
        return { ...art, summary_ko: res.text };
      } catch (e) {
        return { ...art, summary_ko: art.description || '' };
      }
    })
  );

  return enriched.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { ...articles[i], summary_ko: '처리 실패' }
  );
}

module.exports = { enrichArticle, parseTextForArticles };
