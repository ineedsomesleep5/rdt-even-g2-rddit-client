import type { RedditPost, RedditComment } from './types';
import { currentFeed } from './constants';

/**
 * UPDATED: Use the Vercel Serverless Function to bypass CORS.
 * This points to api/proxy.js which fetches data server-side.
 * * We use 'encodeURIComponent' in the functions below to ensure 
 * the entire Reddit path (including ?limit=...) is passed as 
 * a single string to our proxy.
 */
const REDDIT_PROXY_PREFIX = '/api/proxy?path=';

async function fetchJson(url: string, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    console.log(`📡 fetchJson (attempt ${attempt}/${retries}): ${url}`);
    let resp: Response;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      resp = await fetch(url, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
    } catch (err: any) {
      const detail = [
        `name=${err?.name}`,
        `message=${err?.message}`,
        `cause=${JSON.stringify(err?.cause)}`,
      ].join(' | ');
      console.error(`📡 fetchJson NETWORK ERROR (attempt ${attempt}/${retries}) for ${url}: ${detail}`);
      if (attempt < retries) {
        const delay = 1000 * attempt;
        console.log(`📡 Retrying in ${delay}ms…`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
    console.log(`📡 fetchJson: status=${resp.status} ok=${resp.ok} type=${resp.type}`);
    if (!resp.ok) {
      let body = '';
      try { body = await resp.text(); } catch { /* ignore */ }
      console.error(`📡 fetchJson HTTP ERROR: ${resp.status} ${resp.statusText} url=${url} body=${body.slice(0, 500)}`);
      // Retry on 5xx / 429
      if ((resp.status >= 500 || resp.status === 429) && attempt < retries) {
        const delay = 1000 * attempt;
        console.log(`📡 Retrying in ${delay}ms…`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw new Error(`HTTP ${resp.status} for ${url}`);
    }
    return resp.json();
  }
}

export async function fetchTopPosts(limit = 30): Promise<RedditPost[]> {
  // 1. Construct the path relative to Reddit (e.g. "/r/funny/top.json")
  const redditPath = currentFeed.path
    ? `/${currentFeed.path}/top.json`
    : `/top.json`;
  
  // 2. Add the query params for Reddit
  const fullRedditUrl = `${redditPath}?limit=${limit}&t=day&raw_json=1`;

  // 3. Encode the WHOLE thing so it passes safely to api/proxy.js
  const proxyUrl = `${REDDIT_PROXY_PREFIX}${encodeURIComponent(fullRedditUrl)}`;
  
  const json = await fetchJson(proxyUrl);
  const children = json?.data?.children ?? [];

  const posts: RedditPost[] = [];

  // Manual/help item like your Java version.
  posts.push({
    id: 'help',
    title:
      'Controls: use list selection to browse; select to open comments; choose Back to return.',
    ups: 0,
    permalink: '',
    subreddit: 'even',
    author: 'system',
    createdUtcSeconds: Math.floor(Date.now() / 1000),
    numComments: 0,
  });

  for (const child of children) {
    const p = child?.data;
    if (!p?.id || !p?.title) continue;
    posts.push({
      id: String(p.id),
      title: String(p.title),
      ups: Number(p.ups ?? 0),
      permalink: String(p.permalink ?? ''),
      subreddit: String(p.subreddit_name_prefixed ?? ''),
      author: String(p.author ?? ''),
      createdUtcSeconds: Number(p.created_utc ?? 0),
      numComments: Number(p.num_comments ?? 0),
    });
  }

  return posts.slice(0, Math.max(1, limit + 1));
}

export async function fetchComments(permalink: string, limit = 50): Promise<RedditComment[]> {
  if (!permalink) return [];
  
  // permalink usually looks like "/r/funny/comments/xyz/title"
  // We need to append .json and parameters
  const fullRedditUrl = `${permalink}.json?limit=${limit}&raw_json=1`;

  // Encode for proxy
  const proxyUrl = `${REDDIT_PROXY_PREFIX}${encodeURIComponent(fullRedditUrl)}`;

  const json = await fetchJson(proxyUrl);

  // Response is [postListing, commentListing]
  const commentListing = json?.[1]?.data?.children ?? [];
  const comments: RedditComment[] = [];

  function extractComment(child: any, comments: RedditComment[], limit: number): void {
    if (comments.length >= limit) return;
    if (child?.kind !== 't1') return;

    const c = child?.data;
    if (!c?.body) return;

    comments.push({
      body: String(c.body),
      author: String(c.author ?? ''),
      createdUtcSeconds: Number(c.created_utc ?? 0),
      ups: Number(c.ups ?? 0),
      depth: Number(c.depth ?? 0),
    });

    // Recursively extract nested replies
    if (c.replies && typeof c.replies === 'object' && c.replies.data?.children) {
      for (const reply of c.replies.data.children) {
        extractComment(reply, comments, limit);
      }
    }
  }

  for (const child of commentListing) {
    extractComment(child, comments, limit);
  }

  return comments;
}
