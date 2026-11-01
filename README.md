# Hacker News Scraper: Search, Threads & "Who Is Hiring"

Pull Hacker News data through the official HN Search API (Algolia). No browser, no proxies, no login: fast and cheap.

## Modes
- **search**: full-text search over stories, comments, Ask HN or Show HN, with date range, minimum points and sort by date or relevance.
- **thread**: a whole discussion flattened into rows with depth and parent IDs.
- **users**: profile, karma and bio.
- **monthlyThreads**: every post of the latest "Ask HN: Who is hiring?", "Who wants to be hired?" or "Freelancer? Seeking freelancer?" threads, parsed into company, remote flag, visa mention, links and contact email, with an optional keyword filter (e.g. python, remote, visa).

## Typical uses
- Brand and competitor mentions on HN, scheduled daily.
- Job-market research and sourcing leads from Who is hiring.
- Collect top discussions on a topic (`minPoints`) for research or content.
- Archive a thread with all comments.

## Input example
```json
{ "mode": "monthlyThreads", "threadKind": "hiring", "monthsBack": 3, "keywordFilter": ["rust", "remote"], "maxItemsPerQuery": 500 }
```

## Pricing
Pay per result: $0.001 per row. 1,000 comments cost $1.

## Limits
Algolia caps each search at 1,000 hits; split a long date range into several runs for more. Contact emails are only what posters themselves published in public hiring threads.
Questions or a field you need? Open an issue on the Actor page; we reply quickly.


Hosted version (pay per result, no setup): https://apify.com/northgrid-data/hacker-news-search-threads-hiring
