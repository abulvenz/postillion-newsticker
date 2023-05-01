import m from "mithril";
import tagl from "tagl-mithril";

import { tickers } from "./tickers";
import Fuse from "fuse.js";
import posthorn from "./posthorn";
const { min } = Math;
const { header, h1, h2, div, a, input, small, footer, p, span, hr, br } =
  tagl(m);
const use = (v, f) => f(v);

tickers.sort((a, b) => -+a.num + +b.num);

/** Page state */
let range = 0;
let search = "";
let MAX = 10;
let byAuthor = [];

console.log(
  Object.keys(
    tickers
      .flatMap((ticker) => ticker.creators)
      .map((name) => name.replaceAll("&nbsp;", "").trim())
      .reduce((acc, v) => {
        acc[v] = 1;
        return acc;
      }, {})
  )
);

const createFuse = () => {
  if (range > 0) {
    const options = {
      includeScore: false,
      threshold: range * 0.01,
      shouldSort: true,
      keys: ["content"],
    };
    return new Fuse(tickers, options);
  } else {
    const haystack = tickers.map((t) => t.content).map((t) => t.toLowerCase());
    return {
      search: (needle) =>
        use(needle.toLowerCase(), (n) =>
          haystack
            .map((c, i) =>
              c.indexOf(n) >= 0 ? { item: tickers[i] } : undefined
            )
            .filter((e) => !!e)
        ),
    };
  }
};

const updateAuthors = () => {
  fuse = createFuse();
  MAX = 10;
  selection = fuse.search(search);
  if (byAuthor.length > 0) {
    console.log(byAuthor);
    console.log(selection);
    selection = selection.filter(
      (ticker) =>
        ticker.item.creators !== "" &&
        ticker.item.creators.some((creator) => byAuthor.indexOf(creator) >= 0)
    );
  }
};

let fuse = createFuse();

let selection = tickers;
selection = fuse.search(search);

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
    div.outerContainer(
      div.ml1vw(
        div.container(
          div.row(
            div["col-md-6 col-sm-12"](
              input({
                width: "100%",
                placeHolder: "Suchbegriff eingeben",
                oninput: (e) => {
                  search = e.target.value;
                  MAX = 10;
                  selection = fuse.search(search);
                  updateAuthors();
                },
              })
            ),
            div["col-md-2 col-sm-12"](
              byAuthor.map((author, idx) => [
                a(
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
                  MAX = 10;
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
              { onclick: () => (MAX = MAX * 10) },
              "Zeige " + min(selection.length, MAX * 10) + "!"
            )
          : null,
        hr(),
        selection
          .slice(0, MAX)
          .map((e) => e.item)
          .map((ticker) =>
            div.ticker(
              "+++ ",
              m.trust(ticker.content),
              " +++ ",
              ticker.creators !== ""
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
              a({ href: ticker.url }, ticker.num)
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
              { onclick: () => (MAX = MAX * 10) },
              "Zeige " + min(selection.length, MAX * 10) + "!"
            )
          : null
      )
    ),
    footer(
      p(
        a(
          { href: "https://github.com/abulvenz/postillion-newsticker" },
          "Quelltext gibt's hier."
        )
      ),
      p(
        "Der Inhalt wurde von der oben verlinkten Postillon-Seite gecached und von der fleißigen Ticker-Gemeinschaft produziert. "
      ),
      p("Ohne Gewähr auf Sittenwidrigkeit, Fehlerfreiheit und Vollständigkeit.")
    ),
  ],
});
