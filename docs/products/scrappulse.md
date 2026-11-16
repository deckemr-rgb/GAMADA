# ScrapPulse

Type up to 4 keywords and get one bilingual (ID/EN) media and public-interest survey report in under 90 seconds, built from 5 public sources, with a dashboard, XLSX and JSON export.

## Persona
- **Rina Maharani (non-technical)**: S2 Ilmu Komunikasi student in Bandung, 26, Android phone priced around Rp2 juta on patchy 4G, knows Excel but no code. Tujuan: Find out within 2 minutes how Indonesian media frame 'tapera', then export XLSX and survey-question ideas for her thesis questionnaire
- **Dimas Pratama (power user)**: Research analyst at a PR agency in Jakarta Selatan, runs about 20 reports a week, compares brands such as 'gojek, grab, maxim, indrive'. Tujuan: Run a 4-keyword, 30-day comparison, pull the JSON into his Python notebook, and re-run the same saved query every Monday at 08:00 WIB
- **Gilang (operator/admin)**: GAMADA owner who hosts the tool on a VPS and watches source health, cache hit rate and Celery queue depth. Tujuan: See at a glance which of the 5 sources is degraded, purge cache, publish changelog entries and set per-user daily quotas

## Journey pengguna
- Rina opens /tools/scrappulse on her phone, reads the info modal (what each source means), types 'tapera', picks 14 hari + ID, and watches the live status line go source by source
- The live status line shows 'Google Trends gagal (429) — laporan tetap dibuat dari 4 sumber'; the report renders with that panel marked 'tidak tersedia' rather than showing a blank chart
- Rina taps 'Unduh XLSX', opens it in Google Sheets and copies the recommended Likert items into Google Forms
- Dimas pastes 'gojek, grab, maxim, indrive, shopeefood'; the 5th keyword is rejected inline with 'maksimal 4 kata kunci' before submit
- Dimas saves the comparison, sets a weekly schedule (Mon 08:00 WIB) and receives an email with the report link and JSON URL
- Dimas's report link expires after he logs out; on login he is returned to the same report id
- Gilang opens /admin/sources, sees Bing RSS p95 latency 6.2s and a 12% error rate in 24h, disables Bing temporarily, and new reports show it as 'dinonaktifkan admin'
- Gilang adds changelog v1.4 'Leksikon ID +800 kata'; it appears on /tools/scrappulse/changelog with a 'Baru' badge for 7 days

## Klaim iklan → yang harus ada → acceptance test
| Klaim | Yang harus benar-benar ada | Acceptance test |
|---|---|---|
| One keyword -> one survey report; compare up to 4 comma-separated keywords | Input parser that splits on commas, trims, dedupes case-insensitively and rejects 0 or more than 4 terms or terms over 60 chars; a single report entity with N keyword sections plus a comparison tab when N is 2 or more | Vitest: parse('gojek, Grab,grab ,maxim') -> ['gojek','grab','maxim']; Playwright: submitting 5 terms shows the error and sends no POST; a 4-term submit produces 1 report id with 4 sections and a comparison chart containing 4 series |
| Period 7/14/30 days, language ID or EN | zod enum period ∈ {7,14,30}, lang ∈ {id,en}; every source query bounded to [now-period, now] in Asia/Jakarta; UI and report copy switch language; sentiment engine chosen per article language | pytest with frozen time 2026-11-17 and fixtures: 0 articles in a 7-day report older than 7×24h; API returns 422 for period=10; Playwright: lang=en renders English headings and article list filtered to EN sources |
| 5 public sources: Google News RSS ID+EN, Bing News RSS, Hacker News API, Wikipedia Pageviews, Google Trends 0-100 | 5 source adapters behind one interface (fetch(keyword, period, lang) -> normalized items | series) with per-source timeout 15s, 2 retries with backoff, 6h Redis cache, and status ok/partial/failed recorded per report; Wikipedia resolves the keyword to an article title via opensearch first; Trends via pytrends with a normalized 0-100 series | pytest with recorded HTTP fixtures (vcrpy): each adapter returns its schema; with Trends mocked to 429 the report completes with sources.trends.status='failed' and 4 OK; report JSON lists exactly 5 source entries |
| Full text of 12 articles via newspaper4k | Celery task picks the top 12 deduped articles (by recency and outlet diversity, max 3 per outlet), fetches with newspaper4k at concurrency 4 and 10s timeout each, falls back to the RSS summary when extraction yields under 200 chars, and stores text length plus extraction status | pytest: given 30 fixture articles, exactly 12 are selected with at most 3 per domain; one fixture timing out yields status='fallback_summary'; total full-text stage under 40s with mocked latency of 3s each |
| Bilingual sentiment: Indonesian lexicon with negation/intensifier rules, VADER for English | ID scorer: lexicon (≥3,000 entries, scores −5..+5), negators {tidak, tak, bukan, belum, jangan, gak, nggak} flip polarity within a 3-token window, intensifiers {sangat, banget, sekali, amat} ×1.5, slang normalizer (bgt->banget); EN uses vaderSentiment compound; labels: pos >0.05, neg <−0.05, else netral | pytest golden set of 200 hand-labeled ID sentences reaches ≥75% accuracy; unit cases: 'tidak bagus' <0, 'sangat bagus' > 'bagus', 'bagus bgt' == 'bagus banget'; EN 'not good' <0 |
| Volume & momentum, topics & media bias, quotes, survey-design recommendations | Daily volume series per keyword; momentum = (last half count − first half count)/max(first half,1) with labels naik/stabil/turun; topics via YAKE keyphrases clustered into 5 topics; media bias table = per outlet article count, mean sentiment, share of negative; quote extractor for “...” text with an attributed speaker (≤40 words); rule-based survey recommendations: 5-8 Likert items from top topics, 1 open question, sample size by Slovin (e=5%) shown with formula | pytest: fixture series [2,2,2,6,6,6] -> momentum=2.0 'naik'; topics length=5; bias rows sorted by count; quote extractor on fixture returns speaker 'Menteri Keuangan'; recommendation for population 1,000,000 returns n=400 |
| 3 outputs: dashboard, XLSX, JSON | Dashboard route /tools/scrappulse/r/:id; XLSX via openpyxl with sheets Ringkasan, Volume, Sentimen, Artikel, Topik, Media, Kutipan, Rekomendasi Survei; JSON with schemaVersion and a zod schema published at /api/scrappulse/schema.json; numbers identical across all 3 | Playwright downloads both files; script parses the XLSX (8 sheet names exact) and the JSON (validates against schema); total article count and mean sentiment equal the dashboard values to 2 decimals |
| Top Search for 8 countries, changelog page, info modal, live status line | Top Search panel for ID, MY, SG, PH, TH, VN, US, GB from the Google Trends daily trending RSS, cached 1h, click a term to prefill the form; /changelog page rendered from DB entries; info modal (source explanations, method, limits) reachable by keyboard; status line streamed via SSE with stage events queued->sources(n/5)->fulltext(n/12)->nlp->done | Playwright: country switcher has exactly 8 options and each renders ≥10 terms from fixtures; clicking a term fills the input; SSE log shows ≥7 ordered events ending with 'done'; modal opens with Enter and closes with Esc and focus returns to the trigger |

## Fitur MVP
- Keyword form with chip input (max 4), period and language selectors, plus example keywords on the empty state
- Async report job (FastAPI + Celery) with SSE progress, cancel button and 120s hard timeout
- 5 source adapters with per-source status and a graceful partial report
- Dashboard: volume line chart, momentum badge, sentiment donut, topics, media bias table, quotes, article list with links
- Survey recommendation panel with copy-to-clipboard and Google Forms-friendly text
- XLSX and JSON export plus a shareable read-only report link
- Report history (search by keyword, filter by date) for logged-in users; anonymous users get 3 reports/day by IP
- Saved queries with weekly/daily schedule (WIB) and email notification via SMTP/Mailpit
- Top Search 8 countries, changelog, info modal
- Admin: source health (latency, error rate 24h), enable/disable source, cache purge, quotas, changelog editor
- Mobile layout usable at 360px width with charts that do not overflow

## Peran
- anonymous (rate-limited, no history)
- member (history, saved queries, schedules)
- admin (source toggles, quotas, changelog, cache)

## Model data
- report: id, userId?, keywords[], period, lang, status, sourceStatus jsonb, createdAt, finishedAt, schemaVersion
- article: id, reportId, keyword, source, outlet, url, title, publishedAt, lang, fullText?, extraction, sentimentScore, sentimentLabel
- series_point: reportId, keyword, source(volume|trends|wiki|hn), date, value
- topic: reportId, keyword, label, keyphrases[], articleIds[]
- quote: reportId, articleId, speaker, text
- survey_reco: reportId, items jsonb, sampleSize, populationAssumed
- saved_query: id, userId, keywords[], period, lang, cron, nextRunAt, lastReportId
- source_health: source, checkedAt, ok, latencyMs, error
- changelog_entry: id, version, title, body, publishedAt

## Integrasi
- Google News RSS (hl=id/en, gl, ceid)
- Bing News RSS (format=rss)
- Hacker News Algolia search API
- Wikimedia REST Pageviews + opensearch
- Google Trends via pytrends and the daily trending RSS
- newspaper4k for article extraction
- vaderSentiment, YAKE, openpyxl
- SMTP/Mailpit for scheduled report emails
- Redis (Celery broker + cache), Postgres schema scrappulse

## Edge case
- Keyword with zero results in all sources -> empty-state report with suggestions, not an error
- Keyword with emoji, quotes or '#' -> sanitized and URL-encoded; SQL/HTML injection strings rendered as text
- Same query submitted twice within 6h -> served from cache in <1s with a 'dari cache' badge and a refresh option
- Trends 429 or a pytrends schema change -> source marked failed and report still completes
- Article in EN on an ID report -> scored with VADER and labeled by detected language
- Duplicate syndicated articles (same title, different outlets) -> deduped by normalized title hash
- User closes the tab mid-job -> job continues; reopening /r/:id resumes SSE or shows the result
- Slow 3G phone -> first status event within 2s and report page JS ≤150KB gzip
- Scheduled run fails -> one retry after 15 min, then a failure email

## Skenario E2E (Playwright/pytest)
- Rina (mobile 375px): 'tapera', 14 days, ID -> report done; downloads XLSX with 8 sheets; copies survey items
- Rina: submits empty input -> inline error, no request sent
- Dimas: 4 keywords, 30 days -> comparison chart with 4 series; JSON validates against the schema
- Dimas: saves query with Monday 08:00 WIB schedule; fake clock triggers the run; Mailpit receives an email containing the report link
- Dimas: tries 5 keywords -> blocked; tries a 6th anonymous report -> 429 with signup prompt
- Gilang: disables Bing source -> next report shows 4 sources with 'dinonaktifkan admin'; re-enable restores 5
- Gilang: publishes changelog v1.4 -> visible on /changelog with 'Baru' badge
- Chaos: Trends mocked 429 + 1 article timeout -> report finishes with partial status and correct counts

## Celah dari critic (wajib ditutup)
- **Google News RSS item links are news.google.com redirect URLs, so newspaper4k extracts nothing from them and the '12 full articles' claim fails silently.** → Add a decode step that resolves Google News article links to the publisher URL (base64 article id decode or follow redirect), and drop items that cannot be decoded. Test: of 20 recorded GN fixtures, at least 18 resolve to non-google domains and at least 10 of the 12 selected have extraction='ok'.
- **Identical queries submitted at the same moment start duplicate Celery jobs and hit the sources twice. The 6 h cache only helps after the first job finishes.** → Single-flight lock in Redis keyed by a hash of normalized keywords+period+lang; the second request attaches to the running job's SSE stream. Test: 5 parallel identical POSTs give 1 Celery task and 5 clients receiving the same reportId.
