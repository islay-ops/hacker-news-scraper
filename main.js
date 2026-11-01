'use strict';
const { Actor, log } = require('apify');
const { search, thread, user, findMonthlyThreads, parsePost } = require('./lib');

const idOf = (s) => { const m = String(s).match(/(?:id=)?(\d{3,})/); return m ? Number(m[1]) : null; };

Actor.main(async () => {
    const input = (await Actor.getInput()) || {};
    const { mode = 'search', queries = [], contentType = 'story', sortByDate = false, fromDate, toDate, minPoints, items = [], usernames = [],
        threadKind = 'hiring', monthsBack = 1, keywordFilter = [], maxItemsPerQuery = 100 } = input;
    let total = 0;
    const push = async (row) => { await Actor.pushData(row, 'item'); total++; };

    if (mode === 'search') {
        const qs = queries.length ? queries : [''];
        for (const query of qs) {
            let n = 0;
            for await (const r of search({ query, tags: contentType, sortByDate, from: fromDate, to: toDate, minPoints, max: maxItemsPerQuery })) { await push({ query, ...r }); n++; }
            log.info(`"${query}": ${n} ${contentType}`);
        }
    } else if (mode === 'thread') {
        const ids = items.map(idOf).filter(Boolean);
        if (!ids.length) throw new Error('mode "thread" needs "items": HN item URLs or IDs');
        for (const id of ids) {
            const rows = await thread(id);
            if (!rows) { log.warning('Not found: ' + id); continue; }
            for (const r of rows.slice(0, maxItemsPerQuery)) await push(r);
            log.info(`thread ${id}: ${Math.min(rows.length, maxItemsPerQuery)} rows`);
        }
    } else if (mode === 'users') {
        for (const u of usernames) { const r = await user(u); if (r) await push(r); else log.warning('No user ' + u); }
    } else if (mode === 'monthlyThreads') {
        const threads = await findMonthlyThreads(threadKind, monthsBack);
        if (!threads.length) throw new Error('No monthly threads found for ' + threadKind);
        const kw = keywordFilter.map((k) => k.toLowerCase());
        for (const t of threads) {
            const rows = await thread(t.id, { maxDepth: 1 });
            let n = 0;
            for (const r of rows.filter((x) => x.depth === 1)) {
                const p = parsePost(r);
                if (kw.length && !kw.some((k) => (p.text || '').toLowerCase().includes(k))) continue;
                if (n >= maxItemsPerQuery) break;
                await push({ thread: t.title, threadId: t.id, ...p }); n++;
            }
            log.info(`${t.title}: ${n} posts`);
        }
    } else throw new Error('Unknown mode ' + mode);
    await Actor.setValue('SUMMARY', { mode, items: total });
    log.info(`Done: ${total} items`);
});
