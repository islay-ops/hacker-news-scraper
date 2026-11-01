'use strict';
// Hacker News via the official HN Search API by Algolia (https://hn.algolia.com/api).
const BASE = 'https://hn.algolia.com/api/v1/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, params = {}, tries = 5) {
    const url = BASE + path + (Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : '');
    let last;
    for (let i = 0; i < tries; i++) {
        try {
            const res = await fetch(url, { headers: { 'user-agent': 'hn-search-actor/1.0', accept: 'application/json' } });
            if (res.status === 404) return null;
            if (res.status === 429 || res.status >= 500) throw new Error('HTTP ' + res.status);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return await res.json();
        } catch (e) { last = e; await sleep(1500 * (i + 1)); }
    }
    throw last;
}

const stripHtml = (h) => (h || '').replace(/<p>/g, '\n').replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '')
    .replace(/&#x27;/g, "'").replace(/&#x2F;/g, '/').replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').trim();

function hitRow(h) {
    const isComment = (h._tags || []).includes('comment');
    return {
        type: isComment ? 'comment' : (h._tags || []).includes('story') ? 'story' : 'item', id: Number(h.objectID),
        title: h.title || h.story_title || null, url: h.url || h.story_url || null,
        text: isComment ? stripHtml(h.comment_text) : stripHtml(h.story_text),
        author: h.author, points: h.points ?? null, numComments: h.num_comments ?? null,
        createdAt: h.created_at, storyId: h.story_id || null, parentId: h.parent_id || null,
        hnUrl: `https://news.ycombinator.com/item?id=${h.objectID}`,
    };
}

async function* search({ query = '', tags = 'story', sortByDate = false, from, to, minPoints, max = 100 }) {
    const nf = [];
    if (from) nf.push('created_at_i>=' + Math.floor(new Date(from).getTime() / 1000));
    if (to) nf.push('created_at_i<=' + Math.floor(new Date(to).getTime() / 1000));
    if (minPoints) nf.push('points>=' + minPoints);
    let page = 0, n = 0;
    while (n < max) {
        const p = { query, tags, hitsPerPage: String(Math.min(1000, max - n)), page: String(page) };
        if (nf.length) p.numericFilters = nf.join(',');
        const j = await api(sortByDate ? 'search_by_date' : 'search', p);
        if (!j || !j.hits.length) return;
        for (const h of j.hits) { yield hitRow(h); if (++n >= max) return; }
        if (++page >= j.nbPages || page >= 50) return; // Algolia caps results at 1000 per query
    }
}

function flatten(node, storyId, parentId, depth, out) {
    out.push({
        type: depth === 0 ? 'story' : 'comment', id: node.id, title: node.title || null, url: node.url || null, text: stripHtml(node.text),
        author: node.author, points: node.points ?? null, createdAt: node.created_at, storyId, parentId, depth,
        hnUrl: `https://news.ycombinator.com/item?id=${node.id}`,
    });
    for (const c of node.children || []) flatten(c, storyId, node.id, depth + 1, out);
}

async function thread(id, { maxDepth = 99 } = {}) {
    const j = await api('items/' + id);
    if (!j) return null;
    const out = []; flatten(j, j.id, null, 0, out);
    return out.filter((r) => r.depth <= maxDepth);
}

async function user(name) {
    const j = await api('users/' + encodeURIComponent(name), {}, 2).catch(() => null); // API returns HTTP 500 for unknown users
    return j ? { type: 'user', username: j.username, karma: j.karma, about: stripHtml(j.about), hnUrl: `https://news.ycombinator.com/user?id=${j.username}` } : null;
}

// "Ask HN: Who is hiring?" / "Who wants to be hired?" / "Freelancer? Seeking freelancer?" threads posted by user whoishiring
async function findMonthlyThreads(kind, count = 1) {
    const q = { hiring: 'Who is hiring', wanted: 'Who wants to be hired', freelance: 'Seeking freelancer' }[kind];
    const j = await api('search_by_date', { query: q, tags: 'story,author_whoishiring', hitsPerPage: '30' });
    return ((j && j.hits) || []).filter((h) => (h.title || '').toLowerCase().includes(q.toLowerCase())).slice(0, count).map((h) => ({ id: Number(h.objectID), title: h.title, createdAt: h.created_at }));
}

function parsePost(row) {
    const first = (row.text || '').split('\n')[0] || '';
    const parts = first.split('|').map((s) => s.trim());
    return {
        ...row, headline: first.slice(0, 300), company: parts[0] || null,
        remote: /\bremote\b/i.test(first) ? true : /\bonsite\b|\bon-site\b/i.test(first) ? false : null,
        visa: /\bvisa\b/i.test(row.text || ''),
        links: [...new Set((row.text || '').match(/https?:\/\/[^\s<>)"]+/g) || [])].slice(0, 10),
        email: ((row.text || '').match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [null])[0],
    };
}

module.exports = { search, thread, user, findMonthlyThreads, parsePost, stripHtml };
