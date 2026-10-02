# apify-flights-agent

How I made the [Google Flights Scraper](https://apify.com/kuezi/google-flights-scraper) Actor answer an AI agent in **one MCP tool call** instead of three. This repo has the setup, the probe script I used to see exactly what an agent receives from the [Apify MCP server](https://mcp.apify.com), the summary module I added to the Actor, and the raw responses before and after.

| Question: "cheapest day in November?" (30-day scan) | Before | After |
|---|---|---|
| Tool calls | 3 (run, poll, read dataset) | **1** |
| Time to answer | ~70 s | **~22 s** |
| Text sent to the agent | ~39,700 characters | **~3,400 characters** |
| Answer | one date, ties hidden | cheapest + tied dates, priciest day, median |

## Use the Actor from Claude Code
1. Get an Apify API token (Apify Console → Settings → API & Integrations) and `export APIFY_TOKEN=...`.
2. Copy [`.mcp.json`](.mcp.json) into your project. Claude Code expands `${APIFY_TOKEN}` from your environment.
3. Ask: *"I'm flexible in November. What's the cheapest day to fly from San Francisco to Honolulu?"*

Other clients (Claude Desktop, Cursor and others) take the same server URL:
```
https://mcp.apify.com/?tools=kuezi/google-flights-scraper
```

## See what the agent sees
[`probe.sh`](probe.sh) speaks MCP's JSON-RPC over HTTP with `curl`, so you can inspect tool lists and tool results without an AI client:
```bash
export APIFY_TOKEN=...
./probe.sh tools/list
./probe.sh tools/call '{"name":"kuezi--google-flights-scraper","arguments":{"routes":["LAX-NRT"],"scanDays":30,"maxFlightsPerSearch":1,"waitSecs":45}}'
```
Running the Actor costs money on your Apify account: a 30-day scan with 1 flight per day is about $0.105 (30 searches × $0.003 + 30 flights × $0.0005).

## The three changes
1. **The answer goes in the status message.** The MCP server passes `statusMessage` straight to the agent, so the Actor now ends with one line per route: cheapest price and weekday, how many other days tie, the priciest day and the median. The line is capped at 950 characters. Day-by-day prices go into the `SUMMARY` record. Code: [`src/summary.js`](src/summary.js), tests: [`test/summary.test.js`](test/summary.test.js) (`npm test`).
2. **The run finishes inside the MCP wait window** (30 s by default, 45 s maximum via `waitSecs`). Each attempt already used a fresh residential proxy session, so I raised the parallel searches from 3 to 10 and cut the pause between searches from 400–1,000 ms to 100–300 ms.
3. **One slow request can't hold the whole run.** The request timeout went from 45 s to 15 s, so a slow attempt is retried on a new IP.

| Build | 30-day scan run time (30/30 searches OK) |
|---|---|
| Old: 3 parallel, long pauses, 45 s timeout | 64.6 s |
| 8 parallel, long pauses, 45 s timeout | 20.2 s and 43.4 s (in the slow run, one search finished 22 s after all the others) |
| New: 10 parallel, short pauses, 15 s timeout | 13.3 s, 16.3 s, 19.5 s, 24.8 s (4 routes run at the same time) |

## Raw responses (2 October 2026)
In [`responses/`](responses/), with run and storage IDs from the "before" run replaced:
- `00-tools-list.json`: the 5 tools an agent gets with this one Actor loaded
- `before-1-call-actor.json` → `before-2-get-actor-run.json` → `before-3-get-dataset-items.json`: the old 3-call path
- `alt-get-dataset-items-with-fields.json`: the same dataset with `fields: "searchDepartureDate,price"` (1,643 characters instead of 34,984)
- `after-1-call-actor.json`: the new single call

## License
MIT
