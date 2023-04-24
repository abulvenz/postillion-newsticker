const taggs = /<[^>]*>/gim;
const sanitize = (e = "") => e.replaceAll(taggs, "");

console.log(
  sanitize(`b>Dickes Danke an alle Autoren:</b><br />
<b><span style="font-size: x-large;">DANKE!</span></b><br />
<br />
<b>Ewige Tabelle (Danke an Olli Garch und archibald! ohne Gewähr; Zahl links: Ticker gesamt, Zahl in Klammern: davon Co.-Beteiligungen):</b><br />
<br />
675 marc (39) (e.V. h.c.)<br />
<br />
384 oga Olli &#8222;Opi&#8220; Garch (0. e.V.) (80)<br />
<br />`)
);

const countNeedles = (haystack = "", needle) =>
  haystack.split("").filter((e) => e === needle).length;

console.log(
  countNeedles(
    sanitize(
      `<span style="font-size: x-small;">ϕ, frcx, marc/ttl, mvt, bfr, p2k, sum<br /></span><p>`
    ),
    ","
  )
);
