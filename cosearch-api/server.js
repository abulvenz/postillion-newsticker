import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import MiniSearch from "minisearch";

// ---------------------------------------------------------------------------
// Load ticker data
// ---------------------------------------------------------------------------

const DATA_FILE = process.env.DATA_FILE || "../tickers_cosearch.js";
const PORT = parseInt(process.env.PORT || "8080", 10);

console.log(`Loading data from ${DATA_FILE}...`);
const raw = readFileSync(DATA_FILE, "utf-8");
const tickers = JSON.parse(raw.replace("export const tickers = \n", ""));

// Add an id to each ticker (MiniSearch needs it)
tickers.forEach((t, i) => {
  t.id = i;
  t.likes = parseInt(t.likes, 10) || 0;
});

console.log(`Loaded ${tickers.length} tickers.`);

// ---------------------------------------------------------------------------
// Build search index
// ---------------------------------------------------------------------------

console.log("Building search index...");
const miniSearch = new MiniSearch({
  fields: ["content"],
  storeFields: ["content", "author", "likes", "url"],
  searchOptions: {
    boost: { content: 2 },
    fuzzy: 0.2,
    prefix: true,
  },
});

miniSearch.addAll(tickers);
console.log(`Index built. ${miniSearch.documentCount} documents indexed.`);

// ---------------------------------------------------------------------------
// Helper: substring search (for exact/contains matching like the original)
// ---------------------------------------------------------------------------

function substringSearch(query, limit) {
  const q = query.toLowerCase();
  const parts = q.includes("&")
    ? q.split("&").map((s) => s.trim())
    : q.includes("|")
      ? q.split("|").map((s) => s.trim())
      : [q];

  const isAnd = q.includes("&");
  const isOr = q.includes("|");

  const results = [];
  for (const t of tickers) {
    const c = t.content.toLowerCase();
    let match;
    if (isAnd) {
      match = parts.every((p) => c.includes(p));
    } else if (isOr) {
      match = parts.some((p) => c.includes(p));
    } else {
      match = c.includes(q);
    }
    if (match) {
      results.push(t);
      if (results.length >= limit) break;
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(res, data, status = 200) {
  res.writeHead(status, {
    ...CORS_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(data));
}

const server = createServer((req, res) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // GET /search?q=...&limit=...&mode=fuzzy|exact
  if (url.pathname === "/search") {
    const q = url.searchParams.get("q") || "";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "200", 10), 1000);
    const mode = url.searchParams.get("mode") || "exact";

    if (!q) {
      // No query: return top tickers by likes
      const top = tickers
        .slice()
        .sort((a, b) => b.likes - a.likes)
        .slice(0, limit);
      return jsonResponse(res, { total: tickers.length, results: top });
    }

    let results;
    if (mode === "fuzzy") {
      results = miniSearch.search(q, { limit }).map((r) => ({
        content: r.content,
        author: r.author,
        likes: r.likes,
        url: r.url,
        score: r.score,
      }));
    } else {
      results = substringSearch(q, limit).map((t) => ({
        content: t.content,
        author: t.author,
        likes: t.likes,
        url: t.url,
      }));
    }

    return jsonResponse(res, { total: results.length, results });
  }

  // GET /stats
  if (url.pathname === "/stats") {
    const authors = {};
    for (const t of tickers) {
      authors[t.author] = (authors[t.author] || 0) + 1;
    }
    return jsonResponse(res, {
      totalTickers: tickers.length,
      totalAuthors: Object.keys(authors).length,
      topAuthors: Object.entries(authors)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([name, count]) => ({ name, count })),
    });
  }

  // GET /health
  if (url.pathname === "/health") {
    return jsonResponse(res, { status: "ok", tickers: tickers.length });
  }

  // 404
  jsonResponse(res, { error: "Not found" }, 404);
});

server.listen(PORT, () => {
  console.log(`Cosearch API listening on http://localhost:${PORT}`);
  console.log(`  GET /search?q=Astronaut&limit=100&mode=exact|fuzzy`);
  console.log(`  GET /stats`);
  console.log(`  GET /health`);
});
