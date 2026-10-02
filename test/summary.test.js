import test from 'node:test';
import assert from 'node:assert/strict';
import { routeStats, statusMessage, weekday } from '../src/summary.js';

const day = (route, date, price, priceLevel = 'typical') => ({ route, departureDate: date, returnDate: null, cheapestPrice: price, priceLevel });

test('weekday from ISO date', () => {
    assert.equal(weekday('2026-11-01'), 'Sun');
    assert.equal(weekday('2026-11-20'), 'Fri');
});

test('routeStats: cheapest ties go to the earliest date, priciest and median', () => {
    const [r] = routeStats([day('SFO-HNL', '2026-11-03', 163), day('SFO-HNL', '2026-11-01', 163), day('SFO-HNL', '2026-11-20', 444), day('SFO-HNL', '2026-11-02', 200)]);
    assert.equal(r.cheapestPrice, 163);
    assert.equal(r.departureDate, '2026-11-01');
    assert.deepEqual(r.cheapestDates, ['2026-11-01', '2026-11-03']);
    assert.equal(r.priciestPrice, 444);
    assert.equal(r.priciestDate, '2026-11-20');
    assert.equal(r.medianPrice, 182);
    assert.equal(r.daysScanned, 4);
    assert.equal(r.pricesByDay[0].weekday, 'Sun');
});

test('routeStats skips routes with no prices', () => {
    assert.deepEqual(routeStats([day('AAA-BBB', '2026-11-01', null)]), []);
});

test('statusMessage answers a scan in one line', () => {
    const stats = routeStats([day('SFO-HNL', '2026-11-01', 163), day('SFO-HNL', '2026-11-02', 163), day('SFO-HNL', '2026-11-20', 444)]);
    const msg = statusMessage({ stats, currency: 'USD', saved: 3, done: 3, total: 3 });
    assert.equal(msg, 'Saved 3 flights from 3/3 searches. SFO-HNL (3 days): cheapest 163 USD on Sun 2026-11-01 (+1 more day at that price), priciest 444 on Fri 2026-11-20, median 163. Day-by-day prices: SUMMARY record.');
});

test('statusMessage for a single date shows Google price level', () => {
    const msg = statusMessage({ stats: routeStats([day('JFK-LAX', '2026-11-12', 184, 'low')]), currency: 'USD', saved: 20, done: 1, total: 1 });
    assert.match(msg, /JFK-LAX 2026-11-12: cheapest 184 USD \(Google: low\)\./);
});

test('statusMessage stays short with many routes', () => {
    const many = [];
    for (let i = 0; i < 40; i++) for (let d = 1; d <= 3; d++) many.push(day(`R${String(i).padStart(2, '0')}-XYZ`, `2026-11-0${d}`, 100 + d));
    const msg = statusMessage({ stats: routeStats(many), currency: 'USD', saved: 120, done: 120, total: 120, failed: 2 });
    assert.ok(msg.length <= 1000, `length ${msg.length}`);
    assert.match(msg, /\+\d+ more routes in SUMMARY\./);
    assert.match(msg, /2 failed \(see FAILED\)\./);
});
