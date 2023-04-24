import m from "mithril";
import tagl from "tagl-mithril";

import { tickers } from "./tickers";
import Fuse from "fuse.js";

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

let selection = tickers.slice(0, MAX);
selection = fuse.search(search).slice(0, MAX);
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
                selection = fuse.search(search).slice(0, MAX);
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
                fuse = createFuse();
                selection = fuse.search(search).slice(0, MAX);
              },
            })
          )
        )
      ),
      selection
        .map((e) => e.item)
        .map((ticker) =>
          div.ticker(
            "+++ ",
            ticker.content,
            " +++ ",
            sanitize(ticker.creators.join("/")) + " ",
            a({ href: ticker.url }, ticker.num)
          )
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
