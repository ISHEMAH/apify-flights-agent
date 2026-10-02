// Per-route answers for SUMMARY and the run's status message.
// The status message is the first thing an AI agent sees (the Apify MCP server returns it with the run),
// so it carries the full answer: cheapest day, priciest day, median. Day-by-day prices go to SUMMARY.

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_STATUS = 950;

export const weekday = (iso) => WEEKDAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()];

function median(nums) {
    const s = [...nums].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/** Group per-search summaries into one record per route. Ties go to the earliest date. */
export function routeStats(searches) {
    const byRoute = new Map();
    for (const s of [...searches].sort((a, b) => a.route.localeCompare(b.route) || a.departureDate.localeCompare(b.departureDate))) {
        if (!byRoute.has(s.route)) byRoute.set(s.route, []);
        byRoute.get(s.route).push(s);
    }
    const out = [];
    for (const [route, list] of byRoute) {
        const priced = list.filter((s) => typeof s.cheapestPrice === 'number');
        if (!priced.length) continue;
        const prices = priced.map((s) => s.cheapestPrice);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const best = priced.filter((s) => s.cheapestPrice === min);
        const worst = priced.find((s) => s.cheapestPrice === max);
        out.push({
            route,
            cheapestPrice: min,
            departureDate: best[0].departureDate,
            returnDate: best[0].returnDate,
            cheapestDates: best.map((s) => s.departureDate),
            priciestPrice: max,
            priciestDate: worst.departureDate,
            medianPrice: median(prices),
            daysScanned: priced.length,
            priceLevel: best[0].priceLevel ?? null,
            pricesByDay: priced.map((s) => ({ departureDate: s.departureDate, weekday: weekday(s.departureDate), cheapestPrice: s.cheapestPrice, priceLevel: s.priceLevel ?? null })),
        });
    }
    return out;
}

function routeLine(r, currency) {
    if (r.daysScanned === 1) {
        return `${r.route} ${r.departureDate}: cheapest ${r.cheapestPrice} ${currency}${r.priceLevel ? ` (Google: ${r.priceLevel})` : ''}`;
    }
    const more = r.cheapestDates.length - 1;
    return `${r.route} (${r.daysScanned} days): cheapest ${r.cheapestPrice} ${currency} on ${weekday(r.departureDate)} ${r.departureDate}`
        + `${more ? ` (+${more} more day${more > 1 ? 's' : ''} at that price)` : ''}`
        + `, priciest ${r.priciestPrice} on ${weekday(r.priciestDate)} ${r.priciestDate}, median ${r.medianPrice}`;
}

/** One status line that answers the question without reading the dataset. Kept under ~950 chars. */
export function statusMessage({ stats, currency, saved, done, total, failed = 0, stoppedForBudget = false }) {
    const head = `Saved ${saved} flights from ${done}/${total} searches.`;
    const tail = `${failed ? ` ${failed} failed (see FAILED).` : ''}${stoppedForBudget ? ' Stopped early at your max charge.' : ''}`
        + (stats.length ? ' Day-by-day prices: SUMMARY record.' : '');
    let body = '';
    let shown = 0;
    for (const r of stats) {
        const line = ` ${routeLine(r, currency)}.`;
        const rest = stats.length - shown - 1;
        const reserve = rest ? ` +${rest} more routes in SUMMARY.`.length : 0;
        if ((head + body + line + tail).length + reserve > MAX_STATUS) break;
        body += line;
        shown++;
    }
    if (shown < stats.length) body += ` +${stats.length - shown} more routes in SUMMARY.`;
    return head + body + tail;
}
