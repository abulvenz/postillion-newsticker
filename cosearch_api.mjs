import fs from "fs";

/**
 * cosearch_api.mjs – Newsticker-Kommentare direkt per Disqus-API holen.
 *
 * Ersetzt cosearch.mjs komplett: kein Puppeteer, kein Browser, keine Cookies.
 * Nur die öffentliche Disqus JSON-API.
 *
 * Der API-Key ist der öffentliche Disqus-Embed-Key, extrahiert aus
 * https://c.disquscdn.com/embedv2/latest/embedv2.js – er wird in jedem
 * Browser bei jedem Disqus-Seitenaufruf geladen und ist nicht geheim.
 *
 * Usage:
 *   node cosearch_api.mjs                    # default range (see below)
 *   node cosearch_api.mjs 2380 2394          # custom range
 *   node cosearch_api.mjs --all              # alle Newsticker (1..max), in 200er-Batches
 */

const API_KEY =
  "E8Uh5l5fHZ6gD8U3KycjAIAk46f68Zw7C6eW8WSjZvCLXebZ7p0r1yrYDrLilk2F";
const FORUM = "postillon";
const POSTS_PER_PAGE = 100;
const THREAD_CACHE_FILE = "thread_cache.json";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fetchJSON = async (url) => {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  return resp.json();
};

const reg_ticker = /\+{3,}\s*(.+?)\s*\+{3,}/g;

// ---------------------------------------------------------------------------
// Phase 1: Build a map of newsticker number → thread ID
// ---------------------------------------------------------------------------

/**
 * Scan all forum threads via threads/list pagination and extract
 * Newsticker entries. Returns a Map<string, {id, title, posts}>.
 * Results are cached to disk so subsequent runs are instant.
 */
async function discoverNewstickers(fromNum, toNum) {
  // Try loading from cache first
  let cache = {};
  try {
    cache = JSON.parse(fs.readFileSync(THREAD_CACHE_FILE, "utf-8"));
  } catch {}

  // Check which numbers we already know
  const needed = [];
  for (let i = fromNum; i <= toNum; i++) {
    if (!cache[i]) needed.push(i);
  }

  if (needed.length === 0) {
    console.log(`All ${toNum - fromNum + 1} threads found in cache.`);
    return cache;
  }

  console.log(
    `Cache has ${Object.keys(cache).length} entries. ` +
      `Scanning forum for ${needed.length} missing threads...`
  );

  const needSet = new Set(needed);
  let found = 0;
  let cursor = null;
  let page = 0;

  while (needSet.size > 0) {
    page++;
    let url =
      `https://disqus.com/api/3.0/threads/list.json` +
      `?api_key=${API_KEY}&forum=${FORUM}&limit=100`;
    if (cursor) url += `&cursor=${cursor}`;

    const data = await fetchJSON(url);

    for (const t of data.response) {
      const m = t.clean_title?.match(/^Newsticker\s*\((\d+)\)/);
      if (!m) continue;
      const num = parseInt(m[1], 10);
      cache[num] = { id: t.id, title: t.clean_title, posts: t.posts || 0 };
      if (needSet.delete(num)) found++;
    }

    if (page % 10 === 0) {
      console.log(
        `  ...page ${page}, still looking for ${needSet.size} threads`
      );
    }

    if (!data.cursor?.hasNext) break;
    cursor = data.cursor.next;

    // Small delay to be polite
    if (page % 5 === 0) await sleep(100);
  }

  if (needSet.size > 0) {
    console.log(
      `  ⚠ Could not find threads for: ${[...needSet].join(", ")}`
    );
  }

  // Save cache
  fs.writeFileSync(THREAD_CACHE_FILE, JSON.stringify(cache, null, 2));
  console.log(
    `Found ${found} new threads in ${page} pages. Cache now has ${Object.keys(cache).length} entries.\n`
  );

  return cache;
}

// ---------------------------------------------------------------------------
// Phase 2: Fetch posts and extract tickers
// ---------------------------------------------------------------------------

/** Fetch all posts (comments) for a thread, handling pagination. */
async function fetchAllPosts(threadId) {
  const posts = [];
  let cursor = null;

  while (true) {
    let url =
      `https://disqus.com/api/3.0/threads/listPosts.json` +
      `?api_key=${API_KEY}&thread=${threadId}&limit=${POSTS_PER_PAGE}`;
    if (cursor) url += `&cursor=${cursor}`;

    const data = await fetchJSON(url);
    posts.push(...data.response);

    if (data.cursor?.hasNext) {
      cursor = data.cursor.next;
    } else {
      break;
    }
  }
  return posts;
}

/** Extract +++ ticker +++ entries from a list of Disqus posts. */
function extractTickers(posts, meta = {}) {
  const tickers = [];
  for (const post of posts) {
    const raw = post.raw_message || "";
    let m;
    reg_ticker.lastIndex = 0;
    while ((m = reg_ticker.exec(raw)) !== null) {
      const text = m[1].trim();
      if (text.toLowerCase() === "newsticker") continue;
      tickers.push({
        content: text,
        author: post.author?.name ?? "?",
        likes: post.likes ?? 0,
        ...meta,
      });
    }
  }
  return tickers;
}

// ---------------------------------------------------------------------------
// Phase 3: Fetch a range of newstickers and return tickers
// ---------------------------------------------------------------------------

async function fetchRange(from, to, existingThreadMap = null) {
  const threadMap = existingThreadMap ?? await discoverNewstickers(from, to);
  const tickers = [];

  for (let i = from; i <= to; i++) {
    const info = threadMap[i];
    if (!info) {
      console.log(`  #${i} – not found, skipping`);
      continue;
    }

    console.log(`  #${i} – thread ${info.id}, ${info.posts} posts`);

    if (info.posts === 0) continue;

    const posts = await fetchAllPosts(info.id);
    const extracted = extractTickers(posts, {
      url: `https://disqus.com/home/discussion/${FORUM}/newsticker_${i}/`,
    });

    console.log(`         → ${extracted.length} tickers extracted`);
    tickers.push(...extracted);

    // Be nice: small delay between threads to avoid rate-limiting
    await sleep(200);
  }

  return tickers;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const OUTPUT_FILE = "tickers_cosearch.js";
const BATCH_SIZE = 200;

const args = process.argv.slice(2);
const allMode = args.includes("--all");

/** Load existing tickers from output file (for merging in --all mode). */
function loadExisting() {
  try {
    const raw = fs.readFileSync(OUTPUT_FILE, "utf-8");
    return JSON.parse(raw.replace("export const tickers = \n", ""));
  } catch {
    return [];
  }
}

function writeOutput(tickers) {
  // Deduplicate by content+url
  const seen = new Set();
  const deduped = tickers.filter((t) => {
    const key = `${t.content}\0${t.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort((a, b) => b.likes - a.likes);

  fs.writeFileSync(
    OUTPUT_FILE,
    "export const tickers = \n" + JSON.stringify(deduped, null, 1)
  );
  return deduped.length;
}

/**
 * Scan the entire forum for all Newsticker threads.
 * Pass skipIfCached=true to skip when cache already has entries
 * (useful for resuming after a previous --all run).
 */
async function discoverAll() {
  let cache = {};
  try {
    cache = JSON.parse(fs.readFileSync(THREAD_CACHE_FILE, "utf-8"));
  } catch {}

  if (Object.keys(cache).length > 100 && !args.includes("--rescan")) {
    console.log(
      `Cache already has ${Object.keys(cache).length} entries. ` +
        `Skipping full scan (use --rescan to force).\n`
    );
    return cache;
  }

  console.log(`Cache has ${Object.keys(cache).length} entries. Scanning entire forum...`);

  let cursor = null;
  let page = 0;
  let found = 0;

  while (true) {
    page++;
    let url =
      `https://disqus.com/api/3.0/threads/list.json` +
      `?api_key=${API_KEY}&forum=${FORUM}&limit=100`;
    if (cursor) url += `&cursor=${cursor}`;

    const data = await fetchJSON(url);

    for (const t of data.response) {
      const m = t.clean_title?.match(/^Newsticker\s*\((\d+)\)/);
      if (!m) continue;
      const num = parseInt(m[1], 10);
      if (!cache[num]) found++;
      cache[num] = { id: t.id, title: t.clean_title, posts: t.posts || 0 };
    }

    if (page % 20 === 0) {
      console.log(`  ...page ${page}, ${Object.keys(cache).length} newstickers found so far`);
    }

    if (!data.cursor?.hasNext) break;
    cursor = data.cursor.next;
    if (page % 5 === 0) await sleep(100);
  }

  fs.writeFileSync(THREAD_CACHE_FILE, JSON.stringify(cache, null, 2));
  console.log(
    `Scan complete: ${page} pages, ${found} new threads. ` +
    `Cache now has ${Object.keys(cache).length} entries.\n`
  );

  return cache;
}

if (allMode) {
  // --all: Discover all newsticker threads, then fetch in batches
  console.log("Mode: --all – fetching ALL newstickers in batches\n");

  const threadMap = await discoverAll();
  const allNums = Object.keys(threadMap).map(Number).sort((a, b) => a - b);
  const maxNum = allNums[allNums.length - 1];
  console.log(
    `Found ${allNums.length} newsticker threads (#${allNums[0]}..#${maxNum})\n`
  );

  let allTickers = loadExisting();
  const existingUrls = new Set(allTickers.map((t) => t.url));

  // Process in batches
  for (let batchStart = allNums[0]; batchStart <= maxNum; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, maxNum);

    // Check how many in this batch we already have
    const batchNums = allNums.filter((n) => n >= batchStart && n <= batchEnd);
    const batchWithPosts = batchNums.filter((n) => threadMap[n]?.posts > 0);
    const alreadyFetched = batchWithPosts.filter((n) =>
      existingUrls.has(
        `https://disqus.com/home/discussion/${FORUM}/newsticker_${n}/`
      )
    );

    if (alreadyFetched.length === batchWithPosts.length) {
      console.log(
        `Batch ${batchStart}..${batchEnd}: ` +
          `${batchNums.length} threads (${batchWithPosts.length} with posts), all done – skipping`
      );
      continue;
    }

    console.log(
      `\n=== Batch ${batchStart}..${batchEnd} ` +
        `(${batchWithPosts.length} threads with posts, ${alreadyFetched.length} already fetched) ===\n`
    );

    const batchTickers = await fetchRange(batchStart, batchEnd, threadMap);
    allTickers.push(...batchTickers);

    // Write after each batch (resume-safe)
    const count = writeOutput(allTickers);
    console.log(`\nBatch done. ${count} total tickers in ${OUTPUT_FILE}\n`);

    // Pause between batches to avoid rate-limiting
    await sleep(1000);
  }

  const finalCount = writeOutput(allTickers);
  console.log(`\nDone. ${finalCount} tickers written to ${OUTPUT_FILE}`);
} else {
  // Range mode
  const rangeStart = parseInt(args[0], 10) || 2169;
  const rangeEnd = parseInt(args[1], 10) || 2269;

  console.log(`Fetching newstickers ${rangeStart}..${rangeEnd}\n`);

  const tickers = await fetchRange(rangeStart, rangeEnd);
  const count = writeOutput(tickers);
  console.log(`\nDone. ${count} tickers written to ${OUTPUT_FILE}`);
}
