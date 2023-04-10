import m from "mithril";
import tagl from "tagl-mithril";

import { tickers } from "./tickers";
import Fuse from "fuse.js";

const { h1, div, a, input, small, footer, p } = tagl(m);

let range = 0;
let search = "";

const createFuse = () => {
  const options = {
    includeScore: false,
    threshold: range * 0.01,
    shouldSort: true,
    // Search in `author` and in `tags` array
    keys: ["content"],
  };
  return new Fuse(tickers, options);
};

let fuse = createFuse();

let selection = tickers.slice(0, 100);
selection = fuse.search(search).slice(0, 100);

m.mount(document.body, {
  view: (vnode) => [
    div.outerContainer(
      h1("Postillon Newsticker Recherche"),
      div.ml8(
        small(
          a(
            { href: "https://www.der-postillon.com/search/label/Newsticker" },
            "zum Original"
          )
        )
      ),
      div.container(
        div.row(
          div["col-sm-6"](
            input({
              placeHolder: "Suchbegriff eingeben",
              oninput: (e) => {
                search = e.target.value;
                selection = fuse.search(search).slice(0, 100);
              },
            })
          ),
          div["col-sm-6"](
            p("Diffusität der Suche"),
            input({
              type: "range",
              min: 0,
              max: 100,
              value: range,
              oninput: (e) => {
                range = +e.target.value;
                fuse = createFuse();
                selection = fuse.search(search).slice(0, 100);
              },
            })
          )
        )
      ),
      selection
        .map((e) => e.item)
        .map((ticker) =>
          div(
            "+++ ",
            ticker.content,
            " +++ ",
            a({ href: ticker.url }, ticker.num)
          )
        )
    ),
    footer.sticky(
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
