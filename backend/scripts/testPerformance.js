#!/usr/bin/env node
/**
 * Cache effectiveness measurement for GET /api/stories.
 *
 * ── Why this was rewritten ──────────────────────────────────────────────────
 * The previous version made exactly two requests and reported the difference as
 * a headline percentage ("57% faster, 2.34x"). Two problems:
 *
 *   1. It read `response.data.data`, but the endpoint returns `{ stories: [...] }`.
 *      It therefore printed "Stories: 0" on both runs — nobody noticed, because
 *      the number it advertised came from the timings, not the payload.
 *   2. A sample of one request per condition measures noise. Cold-start effects,
 *      GC and connection setup all land entirely in the first request, which is
 *      by construction the uncached one.
 *
 * This version takes N samples per condition, discards warm-up requests, and
 * reports median and p95 rather than a single number. It also verifies via the
 * X-Cache-Status header that the "cached" run was actually served from cache —
 * without that check the script cannot tell a cache hit from a fast database.
 *
 * ── Honest scope ────────────────────────────────────────────────────────────
 * This is a single-client latency probe against one endpoint on one machine. It
 * is NOT a benchmark: no concurrency, no load, no percentile stability
 * guarantees. Treat the output as "the cache is doing something measurable
 * here", not as a performance claim to publish.
 */

require('dotenv').config();
const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:5000';
const ENDPOINT = `${API_URL}/api/stories`;
const SAMPLES = Number(process.env.PERF_SAMPLES || 30);
const WARMUP = Number(process.env.PERF_WARMUP || 5);

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const percentile = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
};

async function timeRequest() {
  const start = process.hrtime.bigint();
  const res = await axios.get(ENDPOINT, { validateStatus: () => true });
  const ms = Number(process.hrtime.bigint() - start) / 1e6;

  return {
    ms,
    status: res.status,
    cache: res.headers['x-cache-status'] || 'none',
    // The endpoint returns { stories: [...] }. The old script looked for
    // `data.data` and always found nothing.
    storyCount: Array.isArray(res.data?.stories) ? res.data.stories.length : 0,
  };
}

async function sample(label, { clearFirst }) {
  const timings = [];
  const cacheStatuses = new Set();
  let storyCount = 0;

  for (let i = 0; i < WARMUP + SAMPLES; i += 1) {
    if (clearFirst) {
      // Force a miss before every measured request.
      try {
        await axios.delete(`${API_URL}/api/cache/clear`, { validateStatus: () => true });
      } catch {
        /* cache endpoint is development-only; ignore */
      }
    }

    const r = await timeRequest();
    if (r.status !== 200) {
      throw new Error(`${ENDPOINT} returned ${r.status} — is the server running?`);
    }

    if (i >= WARMUP) {
      timings.push(r.ms);
      cacheStatuses.add(r.cache);
      storyCount = r.storyCount;
    }
  }

  return { label, timings, cacheStatuses, storyCount };
}

(async () => {
  console.log('FailFixes — cache latency probe');
  console.log(`endpoint : ${ENDPOINT}`);
  console.log(`samples  : ${SAMPLES} (after ${WARMUP} warm-up requests)\n`);

  const uncached = await sample('uncached (cache cleared each time)', { clearFirst: true });
  const cached = await sample('cached', { clearFirst: false });

  if (uncached.storyCount === 0) {
    console.warn('⚠️  The endpoint returned 0 stories. Seed some data or this measures an empty query.\n');
  }

  const report = ({ label, timings, cacheStatuses }) => {
    console.log(label);
    console.log(`  median : ${median(timings).toFixed(1)} ms`);
    console.log(`  p95    : ${percentile(timings, 95).toFixed(1)} ms`);
    console.log(`  cache  : ${[...cacheStatuses].join(', ') || 'n/a'}\n`);
  };

  report(uncached);
  report(cached);

  // Without this the script cannot distinguish a cache hit from a fast query,
  // and any speedup it reports is unattributed.
  if (!cached.cacheStatuses.has('HIT')) {
    console.log('❌ The "cached" run never reported X-Cache-Status: HIT.');
    console.log('   Redis is not configured or not reachable, so there is nothing to measure.');
    console.log('   No performance claim can be made from this run.');
    process.exit(1);
  }

  const mUncached = median(uncached.timings);
  const mCached = median(cached.timings);
  const improvement = ((mUncached - mCached) / mUncached) * 100;

  console.log('─'.repeat(60));
  console.log(`median uncached : ${mUncached.toFixed(1)} ms`);
  console.log(`median cached   : ${mCached.toFixed(1)} ms`);
  console.log(`improvement     : ${improvement.toFixed(1)}% (${(mUncached / mCached).toFixed(2)}x)`);
  console.log(`stories/page    : ${cached.storyCount}`);
  console.log('─'.repeat(60));
  console.log('\nScope: single client, one endpoint, one machine, no concurrency.');
  console.log('Re-run on your own hardware before quoting any of these numbers.');
})().catch((err) => {
  console.error('Probe failed:', err.message);
  process.exit(1);
});
