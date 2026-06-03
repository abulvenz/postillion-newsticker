import m from "mithril";
import tagl from "tagl-mithril";

import { tickers } from "./tickers_cosearch";
import Fuse from "fuse.js";
import posthorn from "./posthorn";
const { min } = Math;
const { keys } = Object;
const {
  header,
  h1,
  h2,
  div,
  a,
  input,
  small,
  footer,
  p,
  span,
  hr,
  br,
  img,
  button,
} = tagl(m);
const use = (v, f) => f(v);
const INCREMENT = 1000;
console.log(tickers.length);

window.onload = () => {
  const tester = document.getElementById("footer");
  window.onresize = window.onscroll = function () {
    if (checkVisible(tester)) {
      MAX += INCREMENT;
      MAX = min(selection.length, MAX);
      m.redraw();
    }
  };
};

function checkVisible(elm) {
  var rect = elm.getBoundingClientRect();
  var viewHeight = Math.max(
    document.documentElement.clientHeight,
    window.innerHeight
  );
  return !(rect.bottom < 0 || rect.top - viewHeight >= 0);
}
const themes = ["default", "dark"];
let brightness = localStorage.getItem("co-brightness") || 0;
let fuzzy = +localStorage.getItem("co-fuzzy") || 0;


const intermediate = tickers.reduce((acc, v) => {
  acc[v.content.trim()] = v;
  return acc;
}, {});

tickers.splice(0, tickers.length);

keys(intermediate)
  .map((e) => intermediate[e])
  .forEach((p) => tickers.push(p));

console.log(tickers.length);

const goDark = (p) => {
  brightness = p % themes.length;
  const param = themes[brightness];
  localStorage.setItem("co-brightness", brightness);
  var head = document.getElementsByTagName("head")[0];
  var link = document.createElement("link");
  link.rel = "stylesheet";
  link.type = "text/css";
  link.href = `https://cdn.rawgit.com/Chalarangelo/mini.css/v3.0.1/dist/mini-${param}.min.css`;
  link.media = "all";
  head.appendChild(link);
};

goDark(brightness);

/** Page state */
let range = 0;
let search = "";
let MAX = INCREMENT;
let byAuthor = [];

const toggleFuzzy = () => {
  fuzzy = fuzzy === 0 ? 1 : 0;
  range = fuzzy === 0 ? 0 : range;
  localStorage.setItem("co-fuzzy", fuzzy);
  m.redraw();
}


const parseQueryString = () => {
  const data = m.parseQueryString(window.location.search);
  range = +data.range || 0;
  search = data.search || "";
  MAX = data.max || MAX;
  byAuthor = data.byAuthor || [];
  console.log(data);
};

parseQueryString();

const buildQueryString = () => {
  const query = m.buildQueryString({
    range,
    search,
    max: MAX,
    byAuthor,
  });

  const newurl =
    window.location.protocol +
    "//" +
    window.location.host +
    window.location.pathname +
    "?" +
    query;
  window.history.pushState({ path: newurl }, "", newurl);
};

window.showStatistics = () => {
  use(
    tickers
      .map((ticker) => ticker.author || "?")
      .reduce((acc, v) => {
        acc[v] = (acc[v] || 0) + 1;
        return acc;
      }, {}),
    (tickerCountByAuthor) => {
      Object.keys(tickerCountByAuthor)
        .sort((a, b) => -tickerCountByAuthor[a] + tickerCountByAuthor[b])
        .forEach((author) => console.log(author, tickerCountByAuthor[author]));
    }
  );
};

const createFuse = () => {
  if (range > 0) {
    const options = {
      includeScore: false,
      threshold: range * 0.01,
      shouldSort: true,
      keys: ["content"],
    };
    const ff = new Fuse(tickers, options);
    return {
      search: (str) => {
        buildQueryString();
        if (str.indexOf("|") >= 0) {
          return ff.search({
            $or: [
              ...str.split("|").map((p) => ({
                content: p.trim().toLowerCase(),
              })),
            ],
          });
        } else if (str.indexOf("&") >= 0) {
          return ff.search({
            $and: [
              ...str.split("&").map((p) => ({
                content: p.trim().toLowerCase(),
              })),
            ],
          });
        } else return ff.search(str.toLowerCase());
      },
    };
  } else {
    const haystack = tickers.map((t) => t.content).map((t) => t.toLowerCase());
    return {
      search: (needle) => {
        buildQueryString();
        if (!needle) return tickers.map((t) => ({ item: t }));
        let finder = (c) => c.indexOf(needle.toLowerCase()) >= 0;
        if (needle.indexOf("&") >= 0) {
          finder = (c) =>
            needle
              .split("&")
              .every((n) => c.indexOf(n.trim().toLowerCase()) >= 0);
        } else if (needle.indexOf("|") >= 0) {
          finder = (c) =>
            needle
              .split("|")
              .some((n) => c.indexOf(n.trim().toLowerCase()) >= 0);
        }
        return haystack
          .map((c, i) => (finder(c) ? { item: tickers[i] } : undefined))
          .filter((e) => !!e);
      },
    };
  }
};

const updateAuthors = () => {
  fuse = createFuse();
  MAX = INCREMENT;
  selection = fuse.search(search);
  if (byAuthor.length > 0) {
    selection = selection.filter(
      (ticker) =>
        ticker.item.author &&
        byAuthor.indexOf(ticker.item.author) >= 0
    );
  }
};

let fuse = createFuse();
let selection = tickers;
selection = fuse.search(search);
updateAuthors();

m.mount(document.body, {
  view: (vnode) => [
    header(
      a.logo(
        img.logoIcon({src: new URL("logo.svg",import.meta.url), alt: "Postillon Logo"}),
        span.logo("Geheimarchive des Postillon"),
      ),
      a({ href: "index.html", style: "margin-left:1rem;font-size:0.85rem;" }, "Hauptseite")
    ),
    div.ml8(
      small(
        tickers.length + " Kommentar-Ticker aus den Disqus-Kommentarspalten. ",
        a(
          { href: "https://www.der-postillon.com/search/label/Newsticker" },
          "Hier"
        ),
        " geht's zum Original auf der Postillon Seite"
      )
    ),
    div.outerContainer.$wrapper(
      div.ml1vw(
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
                  selection = fuse.search(search);
                  updateAuthors();
                },
              })
            ),
            div["col-md-2 col-sm-12"](
              byAuthor.map((author, idx) => [
                a.tag(
                  {
                    onclick: () => {
                      byAuthor.splice(byAuthor.indexOf(author), 1);
                      updateAuthors();
                    },
                  },
                  author
                ),
                idx < byAuthor.length - 1 ? "/" : "",
              ])
            ),
            fuzzy
              ? div["col-md-4 col-sm-12"](
                  p(
                    span.tooltip.bottom(
                      {
                        "aria-label":
                          "Ganz links wird die komplette Eingabe gesucht. Danach immer fuzzier.",
                      },
                      "Diffusität der Suche"
                    )
                  ),
                  input({
                    type: "range",
                    min: 0,
                    max: 100,
                    value: range,
                    oninput: (e) => {
                      range = +e.target.value;
                      MAX = INCREMENT;
                      fuse = createFuse();
                      selection = fuse.search(search);
                      updateAuthors();
                    },
                  })
                )
              : null
          )
        ),
        "Hier sind " +
          min(MAX, selection.length) +
          " von " +
          selection.length +
          ". ",
        MAX < selection.length
          ? a(
              {
                onclick: () => {
                  MAX = selection.length;
                  buildQueryString();
                },
              },
              "Zeige alle!"
            )
          : null,
        hr(),
        selection
          .slice(0, MAX)
          .map((e) => e.item)
          .map((ticker) =>
            div.ticker(
              use(ticker?.content?.indexOf("++") >= 0, (systemSprenger) => [
                systemSprenger ? "" : "+++ ",
                m.trust(ticker.content),
                systemSprenger ? " " : " +++ ",
              ]),
              span(
                a(
                  {
                    onclick: () => {
                      if (byAuthor.indexOf(ticker.author) < 0)
                        byAuthor.push(ticker.author);
                      updateAuthors();
                    },
                  },
                  ticker.author || "?"
                ),
                " "
              ),
              ticker.likes > 0
                ? span({ style: "color:#888;font-size:0.85rem;" },
                    ticker.likes + (ticker.likes === 1 ? " Like" : " Likes"), " ")
                : null,
              a(
                { href: ticker.url },
                ticker.url?.match(/newsticker_(\d+)/)?.[1] || "Link"
              )
            )
          ),
        hr(),
        "Das waren " +
          min(MAX, selection.length) +
          " von " +
          selection.length +
          ". ",
        MAX < selection.length
          ? a(
              {
                onclick: () => {
                  MAX = selection.length;
                  buildQueryString();
                },
              },
              "Zeige alle!"
            )
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
        a(
          {
            onclick: () => {
              const csv = tickers
                .map(
                  (ticker) =>
                    '"' +
                    ticker.content.replaceAll('"', '""') +
                    '","' +
                    (ticker.author || "") +
                    '","' +
                    (ticker.likes || 0) +
                    '","' +
                    ticker.url +
                    '"'
                )
                .join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = window.URL.createObjectURL(blob);

              const a = document.createElement("a");
              a.setAttribute("href", url);
              a.setAttribute("download", "tickers_cosearch.csv");
              a.click();
            },
          },
          "Download aller Ticker als CSV"
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
          { onclick: (e) => goDark(brightness + 1) },
          brightness === 0
            ? "Nur die Dunkelheit ist echt, "
            : "aber das Licht scheint so."
        ),
        button.small(
          { onclick: (e) => toggleFuzzy() },
          fuzzy === 1
            ? "Fuzzy-Suche ist an"
            : "Fuzzy-Suche ist aus"
        )
      )
    ),
  ],
});
