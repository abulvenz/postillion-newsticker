import m from "mithril";
import tagl from "tagl-mithril";

import { tickers } from "./tickers";
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
let brightness = localStorage.getItem("brightness") || 0;

const intermediate = tickers.reduce((acc, v) => {
  acc[v.content.trim()] = v;
  return acc;
}, {});

tickers.splice(0, tickers.length);

keys(intermediate)
  .map((e) => intermediate[e])
  .forEach((p) => tickers.push(p));

console.log(tickers.length);

tickers.sort((a, b) => -+a.num + +b.num);

const goDark = (p) => {
  brightness = p % themes.length;
  const param = themes[brightness];
  localStorage.setItem("brightness", brightness);
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


// console.log(tickers.filter(t=>!t.creators || t.creators.includes(undefined)))

use(
  tickers
    .flatMap((ticker) => ticker.creators || [])
    .map((name) => name.replaceAll("&nbsp;", "").trim())
    .reduce((acc, v) => {
      acc[v] = (acc[v] || 0) + 1;
      return acc;
    }, {}),
  (tickerCountByAuthor) => {
    Object.keys(tickerCountByAuthor)
      .filter((author) => tickerCountByAuthor[author] < 40)
      .forEach((author) => delete tickerCountByAuthor[author]);

    Object.keys(tickerCountByAuthor)
      .sort((a, b) => -tickerCountByAuthor[a] + tickerCountByAuthor[b])
      .forEach((author) => console.log(author, tickerCountByAuthor[author]));
  }
);

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
    //console.log(byAuthor);
    //console.log(selection);
    selection = selection.filter(
      (ticker) =>
        ticker.item.creators &&
        ticker.item.creators.some((creator) => byAuthor.indexOf(creator) >= 0)
    );
  }
};

let fuse = createFuse();
let selection = tickers;
selection = fuse.search(search);
updateAuthors();

const imageC = (vnode) => ({
  view: ({ attrs: { ticker } }) => {
    //   console.log(ticker);
    return ticker.image
      ? ticker.display
        ? img.thumbnail({
            onclick: () => (ticker.display = undefined),
            src: ticker.image.replace("w1600", "w800"),
          })
        : a({ onclick: () => (ticker.display = true) }, " 🖼️")
      : null;
  },
});

m.mount(document.body, {
  view: (vnode) => [
    header(
      a.logo(
        m(posthorn, { width: "70px", height: "35px" }),
        span.logo("Geheimarchive des Postillon")
      )
    ),
    div.ml8(
      small(
        tickers.length + " Tickermeldungen wurden bisher gepostet. ",
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
            div["col-md-4 col-sm-12"](
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
              ticker.creators
                ? ticker.creators.map((creator, index) =>
                    span([
                      a(
                        {
                          onclick: () => {
                            if (byAuthor.indexOf(creator) < 0)
                              byAuthor.push(creator);
                            updateAuthors();
                          },
                        },
                        "" + creator
                      ),
                      index < ticker.creators.length - 1 ? "/" : " ",
                    ])
                  )
                : "[Fehler bei Autorenbestimmung] ",
              a(
                { href: ticker.url },
                ticker?.url?.indexOf("the-postillon.com") < 0
                  ? /*"🇩🇪"*/ ""
                  : "🇬🇧 ",
                ticker.num || "Keine Nummer"
              ),
              m(imageC, { ticker })
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
                    ticker.url +
                    '","' +
                    ticker.num +
                    '","' +
                    (ticker.image || "") +
                    '","' +
                    ticker.creators.join("/") +
                    '"'
                )
                .join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = window.URL.createObjectURL(blob);

              const a = document.createElement("a");
              a.setAttribute("href", url);
              a.setAttribute("download", "tickers.csv");
              a.click();
            },
          },
          "Download aller Ticker als 🗜️ CSV"
        )
      ),
      p(
        "Der Inhalt wird von der oben verlinkten Postillon-Seite montags, mittwochs und freitags gecached und wird von der fleißigen Ticker-Gemeinschaft produziert. "
      ),
      p(
        "Ohne Gewähr auf Sittenwidrigkeit, Fehlerfreiheit und Vollständigkeit."
      ),
      button.small(
        { onclick: (e) => goDark(brightness + 1) },
        brightness === 0
          ? "Nur die Dunkelheit ist echt, "
          : "aber das Licht scheint so."
      )
    ),
  ],
});
