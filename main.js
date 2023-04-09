import m from "mithril";
import tagl from "tagl-mithril";

import { tickers } from "./tickers";
import Fuse from "fuse.js";

const { h1, div, a, input } = tagl(m);

const options = {
  includeScore: false,
  threshold: 0.1,
  shouldSort: true,
  // Search in `author` and in `tags` array
  keys: ["content"],
};

let selection = tickers.slice(0, 100);

const fuse = new Fuse(tickers, options);

selection = fuse.search("").slice(0, 100);

m.mount(document.body, {
  view: (vnode) => [
    h1("Newsticker Recherche"),
    input({
      oninput: (e) => {
        console.log(e.target.value);
        selection = fuse.search(e.target.value).slice(0, 100);
        console.log(selection);
      },
    }),
    selection
      .map((e) => e.item)
      .map((ticker) =>
        div(
          "+++ ",
          ticker.content,
          " +++ ",
          a({ href: ticker.url }, ticker.num)
        )
      ),
  ],
});
