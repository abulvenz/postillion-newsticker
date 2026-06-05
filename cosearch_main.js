import m from "mithril";
import tagl from "tagl-mithril";
import posthorn from "./posthorn";

const { min } = Math;
const {
  header,
  div,
  a,
  input,
  small,
  footer,
  p,
  span,
  hr,
  img,
  button,
} = tagl(m);
const use = (v, f) => f(v);

// ---------------------------------------------------------------------------
// API configuration
// ---------------------------------------------------------------------------

const API_BASE =
  localStorage.getItem("cosearch-api") || "http://localhost:8080";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const themes = ["default", "dark"];
let brightness = localStorage.getItem("co-brightness") || 0;
let fuzzy = +localStorage.getItem("co-fuzzy") || 0;
let search = "";
let results = [];
let totalTickers = 0;
let loading = false;
let error = null;
let debounceTimer = null;
let byAuthor = [];

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

async function apiSearch(query, mode = "exact", limit = 500) {
  const params = new URLSearchParams({ q: query, mode, limit });
  if (byAuthor.length > 0) {
    params.set("author", byAuthor.join(","));
  }
  const resp = await fetch(`${API_BASE}/search?${params}`);
  if (!resp.ok) throw new Error(`API error: ${resp.status}`);
  return resp.json();
}

async function doSearch() {
  loading = true;
  error = null;
  m.redraw();

  try {
    const mode = fuzzy ? "fuzzy" : "exact";
    const data = await apiSearch(search, mode);
    results = data.results || [];
    totalTickers = data.total || results.length;

    // Client-side author filter (if set)
    if (byAuthor.length > 0) {
      results = results.filter(
        (t) => t.author && byAuthor.includes(t.author)
      );
    }
  } catch (e) {
    error = e.message;
    results = [];
  }

  loading = false;
  m.redraw();
}

function debouncedSearch() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(doSearch, 250);
}

// ---------------------------------------------------------------------------
// URL state
// ---------------------------------------------------------------------------

const parseQueryString = () => {
  const data = m.parseQueryString(window.location.search);
  search = data.search || "";
  byAuthor = data.byAuthor ? [].concat(data.byAuthor) : [];
};

const buildQueryString = () => {
  const query = m.buildQueryString({ search, byAuthor });
  const newurl =
    window.location.protocol +
    "//" +
    window.location.host +
    window.location.pathname +
    "?" +
    query;
  window.history.pushState({ path: newurl }, "", newurl);
};

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

const goDark = (p) => {
  brightness = p % themes.length;
  const param = themes[brightness];
  localStorage.setItem("co-brightness", brightness);
  const head = document.getElementsByTagName("head")[0];
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.type = "text/css";
  link.href = `https://cdn.rawgit.com/Chalarangelo/mini.css/v3.0.1/dist/mini-${param}.min.css`;
  link.media = "all";
  head.appendChild(link);
};

goDark(brightness);

// ---------------------------------------------------------------------------
// Init: parse URL, do initial search
// ---------------------------------------------------------------------------

parseQueryString();
doSearch();

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

const INCREMENT = 500;
let MAX = INCREMENT;

window.onload = () => {
  const tester = document.getElementById("footer");
  window.onresize = window.onscroll = function () {
    if (tester && checkVisible(tester)) {
      MAX += INCREMENT;
      MAX = min(results.length, MAX);
      m.redraw();
    }
  };
};

function checkVisible(elm) {
  const rect = elm.getBoundingClientRect();
  const viewHeight = Math.max(
    document.documentElement.clientHeight,
    window.innerHeight
  );
  return !(rect.bottom < 0 || rect.top - viewHeight >= 0);
}

m.mount(document.body, {
  view: () => [
    header(
      a.logo(
        img.logoIcon({
          src: new URL("logo.svg", import.meta.url),
          alt: "Postillon Logo",
        }),
        span.logo("Geheimarchive des Postillon")
      ),
      a(
        { href: "index.html", style: "margin-left:1rem;font-size:0.85rem;" },
        "Hauptseite"
      )
    ),
    div.ml8(
      small(
        loading
          ? "Suche..."
          : totalTickers + " Kommentar-Ticker durchsuchbar. ",
        a(
          { href: "https://www.der-postillon.com/search/label/Newsticker" },
          "Hier"
        ),
        " geht's zum Original auf der Postillon Seite"
      )
    ),
    div.outerContainer.$wrapper(
      div.ml1vw(
        // Search input
        div.container(
          div.row(
            div["col-md-6 col-sm-12"](
              input({
                value: search,
                width: "100%",
                placeHolder: "Suchbegriff eingeben",
                oninput: (e) => {
                  search = e.target.value;
                  MAX = INCREMENT;
                  buildQueryString();
                  debouncedSearch();
                },
              })
            ),
            div["col-md-2 col-sm-12"](
              byAuthor.map((author, idx) => [
                a.tag(
                  {
                    onclick: () => {
                      byAuthor.splice(byAuthor.indexOf(author), 1);
                      buildQueryString();
                      doSearch();
                    },
                  },
                  author
                ),
                idx < byAuthor.length - 1 ? "/" : "",
              ])
            )
          )
        ),

        // Status line
        error
          ? p({ style: "color:red;" }, "Fehler: ", error)
          : loading
            ? p("Suche...")
            : [
                "Hier sind " +
                  min(MAX, results.length) +
                  " von " +
                  results.length +
                  ". ",
                MAX < results.length
                  ? a(
                      {
                        onclick: () => {
                          MAX = results.length;
                        },
                      },
                      "Zeige alle!"
                    )
                  : null,
              ],

        hr(),

        // Results
        results.slice(0, MAX).map((ticker) =>
          div.ticker(
            use(
              ticker?.content?.indexOf("++") >= 0,
              (systemSprenger) => [
                systemSprenger ? "" : "+++ ",
                m.trust(ticker.content),
                systemSprenger ? " " : " +++ ",
              ]
            ),
            span(
              a(
                {
                  onclick: () => {
                    if (!byAuthor.includes(ticker.author)) {
                      byAuthor.push(ticker.author);
                      buildQueryString();
                      doSearch();
                    }
                  },
                },
                ticker.author || "?"
              ),
              " "
            ),
            ticker.likes > 0
              ? span(
                  { style: "color:#888;font-size:0.85rem;" },
                  ticker.likes + (ticker.likes === 1 ? " Like" : " Likes"),
                  " "
                )
              : null,
            a(
              { href: ticker.url },
              ticker.url?.match(/newsticker_(\d+)/)?.[1] || "Link"
            )
          )
        ),

        hr(),
        !loading && results.length > 0
          ? [
              "Das waren " +
                min(MAX, results.length) +
                " von " +
                results.length +
                ". ",
              MAX < results.length
                ? a(
                    {
                      onclick: () => {
                        MAX = results.length;
                      },
                    },
                    "Zeige alle!"
                  )
                : null,
            ]
          : null
      )
    ),
    footer.$footer(
      p(
        a(
          { href: "https://github.com/abulvenz/postillion-newsticker" },
          "Quelltext gibt's hier."
        )
      ),
      p(
        "Ticker aus den Disqus-Kommentarspalten, gesammelt per API. "
      ),
      p(
        "Ohne Gewähr auf Sittenwidrigkeit, Fehlerfreiheit und Vollständigkeit."
      ),
      div.buttonGroup(
        button.small(
          { onclick: () => goDark(brightness + 1) },
          brightness === 0
            ? "Nur die Dunkelheit ist echt, "
            : "aber das Licht scheint so."
        ),
        button.small(
          { onclick: () => { fuzzy = fuzzy === 0 ? 1 : 0; localStorage.setItem("co-fuzzy", fuzzy); doSearch(); } },
          fuzzy === 1 ? "Fuzzy-Suche ist an" : "Fuzzy-Suche ist aus"
        )
      )
    ),
  ],
});
