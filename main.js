import m from "mithril";
import tagl from "tagl-mithril";

import { tickers } from "./tickers";
import Fuse from "fuse.js";
const { min } = Math;
const { h1, h2, div, a, input, small, footer, p, span } = tagl(m);
const use = (v, f) => f(v);
let useContains = true;
let range = 0;
let search = "";
let MAX = 10;

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

let fuse = createFuse();

let selection = tickers;
selection = fuse.search(search);
const taggs = /<[^>]*>/gim;
const sanitize = (e = "") => console.log(e) || e.replaceAll(taggs, "");

m.mount(document.body, {
  view: (vnode) => [
    div.outerContainer(
      h1("Geheimarchive des Postillon"),
      h2("Newsticker Recherche"),
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
      div.container(
        div.row(
          div["col-md-6 col-sm-12"](
            input({
              placeHolder: "Suchbegriff eingeben",
              oninput: (e) => {
                search = e.target.value;
                MAX = 10;
                selection = fuse.search(search);
              },
            })
          ),
          div["col-md-6 col-sm-12"](
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
              },
            })
          )
        )
      ),
      selection
        .slice(0, MAX)
        .map((e) => e.item)
        .map((ticker) =>
          div.ticker(
            "+++ ",
            ticker.content,
            " +++ ",
            (ticker.creators !== ""
              ? sanitize(ticker.creators.join("/"))
              : "[Fehler bei Autorenbestimmung]") + " ",
            a({ href: ticker.url }, ticker.num)
          )
        ),
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
