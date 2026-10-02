#!/usr/bin/env bash
# Talk to the hosted Apify MCP server the way an AI client does: plain JSON-RPC over HTTP.
# usage: APIFY_TOKEN=... ./probe.sh <method> [params-json] [tools]
#   ./probe.sh tools/list
#   ./probe.sh tools/call '{"name":"kuezi--google-flights-scraper","arguments":{"routes":["LAX-NRT"],"scanDays":30,"maxFlightsPerSearch":1,"waitSecs":45}}'
set -euo pipefail
: "${APIFY_TOKEN:?Set APIFY_TOKEN (Apify Console > Settings > API & Integrations)}"
METHOD="$1"; PARAMS="${2:-}"; [ -z "$PARAMS" ] && PARAMS='{}'
TOOLS="${3:-kuezi/google-flights-scraper}"
URL="https://mcp.apify.com/?tools=$TOOLS"
H=(-H "Authorization: Bearer $APIFY_TOKEN" -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream')

SID=$(curl -s -D - -o /dev/null "${H[@]}" -X POST "$URL" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"0.1"}}}' \
  | grep -i '^mcp-session-id' | awk '{print $2}' | tr -d '\r')
curl -s "${H[@]}" -H "Mcp-Session-Id: $SID" -X POST "$URL" -d '{"jsonrpc":"2.0","method":"notifications/initialized"}' > /dev/null

# Responses come as server-sent events; keep only the JSON payload.
curl -s "${H[@]}" -H "Mcp-Session-Id: $SID" -X POST "$URL" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"$METHOD\",\"params\":$PARAMS}" | sed -n 's/^data: //p'
