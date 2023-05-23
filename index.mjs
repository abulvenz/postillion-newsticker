import puppeteer from "puppeteer";
import regex from "./regex.mjs";
import fs, { readFileSync } from "fs";

const clearEverything = true;
const displayBrowser = false;

const maximumNumberOfPages = 1e100;

const countStr = (haystack, needle) =>
  haystack.split("").filter((e) => e === needle).length;

const exceptionalStuffByUrl = {
  "https://www.der-postillon.com/2017/05/newsticker-1053.html": {
    authors: "marc, evw, rav, tsc, hpa, tom, tei",
  },
  "https://www.der-postillon.com/2017/01/newsticker-1003.html": {
    authors: "tsc, p2k, sen, evw, kol, mag, wwe",
  },
  "https://www.der-postillon.com/2017/01/newsticker-1000.html": {
    tickers: [
      "Mit Fuchsschwanz abgesägt: Manta-Antenne gestohlen",
      "Dorffelltester: Stammesfürst darf Tierhäute als Erster anprobieren",

      "Eingemischt: Polier bei Streitschlichtung in Betonmaschine gestürzt",
      "Hinterlässt verbrannte Erde: Unfähiger Elektriker flüchtet ins Weltall",
      "Geht abends gern zur Au-Pair: Ehemann täuscht Kulturinteresse vor",
      "Kriegt kein Auge zu: Leichenpräparator muss die Nacht durcharbeiten",
      "Lässt ihn einfach stehen: Frau möchte mit Mann nicht mehr über ihren Bart reden",

      "Hat alles probiert: Junkie kommt von keiner einzigen Droge los",
      "Schuhregal: Schäfer schreinert lieber",
      "Massiert dort seine Truppen: Feldherr schickt Physiotherapeuten an die Front",
      "Barbie-Kuh: Ken beschimpft beste Freundin während Grillfest",
      "Jetzt ist er dran: Mann muss erklären, warum er Anruf zuerst wegdrückte",

      "Folge packt: Neue Serien-Episode mit Action gefüllt",
      "Zecken-Hemd-Shop: Gebrauchtwarenladen bietet Oberbekleidung für Spinnentiere an",
      "Frei erfunden: Urlaub gibt es gar nicht",
      "Darmwinde: Verschluckter Flaschenzug verursacht Blähungen",
      "Brünett: Kannibalenkoch wünscht braunhaarigem Opfer viel Spaß",

      "Geht immer gleich vor: Konzertbesucher drängelt sich wiederholt in erste Reihe",
      "Beutelkunst: Känguruh hält Gemälde versteckt",
      '"Stehenbleiben, Sie sind umzüngelt!": Schlangenbeschwörer stellt Dieb',
      "Salbei: Arzt behandelt Hodenverletzung mit Kräuterbalsam",
      "Hat alle berührt: Bewegende Geschichte eines Triebtäters",

      "Kein schönes Bild: Porträtierter vermöbelt Maler",
      "Hat ihm das Haus zugedacht: Telepath überträgt Sohn sein Erbe",
      "Falschparka: Politesse verteilt Knöllchen an Modesünder",
      "Pulli-Zerr-Preis gewonnen: Fotograf erfolgreich am Wühltisch",
      "Hangar: Pilot grillt Vogel in Flugzeughalle",
    ],
    authors:
      "oga, tsc, kop, wwe, tom, kol, be+, rag, adl, marc, rav, frcx, wye, ber, sta, ban, len, tei, p2k, lou, rot, adg, sod, hpa, evw, rbo, kly,bor/fla/marc,b&b",
  },
  "https://www.der-postillon.com/2016/12/newsticker-993.html": {
    authors: "mpr, mvp, die/adl, hwi, tsc, wwe, oga",
  },
  "https://www.der-postillon.com/2015/07/newsticker-774.html": {
    authors: "sta, daw, rag, rta, wwe, hos, rai/sod",
    tickers: [
      "Hatte sich daneben benommen: Hooligan abseits des Stadions erstaunlich nett",
      "Wachmeister: Polizist gewinnt Nicht-Einschlaf-Wettbewerb",
      "Sauber getrennt: Deutschlehrerin mit Abschieds-<br>brief von Ehemann zufrieden",
      "Maribor: Slowenische Zahnarzthelferin zur Arbeit aufgefordert",
      "Russisch-Rollator: Altenheimbewohner zocken mit nicht bremsbarer Gehhilfe",
      "Darf Weiter: Anakin Skywalker bei Kontrolle durchgewinkt",
      "Ist ihm über den Mund gefahren: Lokführer bringt schreienden Selbstmörder zum Schweigen",
    ],
  },
  "https://www.der-postillon.com/2015/01/newsticker-704.html": {
    authors: "vpe, kop, marc, ban, dtw, sod, gad",
    tickers: [
      "Drahtseilakt: Nacktshooting mit Artistin schwieriger als gedacht",
      "Zauberei: Kaninchen geschlüpft",
      "Keiner ist auf seiner Seite: Familie rät Opa geschlossen zu Homepage-Löschung",
      "+++ Weltneuheit: Batteriebetriebener Newsticker - - -",
      "Alle müssen Opfer bringen: Krankenwagenfahrern steht Urlaubskürzung bevor",
      "Hochkant: Philosoph wirft lärmende Geburtstagsgäste raus",
      "Fährt wieder nur zwischen Halle und Hof: Staplerfahrer hat auf Trucker umgeschult      ",
    ],
  },
  "https://www.der-postillon.com/2014/04/newsticker-599.html": {
    authors: "tim, hg/marc, phi, mlo, tbu, dep, oga",
    tickers: [
      "Service wird großgeschrieben: Duden beantwortet Kundenanfrage sofort",
      "Hautkrebs: Mann lässt Wut über Diagnose an Krustentier aus",
      "Salmonisches Urteil: Lachs in zwei gleiche Hälften aufgeteilt",
      "Las sie: Collie entdeckt Leidenschaft zu Büchern",
      "+++ Voreilig: Schlagzeile war noch gar",
      "Alteingesessen: 90-Jähriger in seinem Geburtsort verhaftet",
      "Alles Kopfsache: Henker erläutert mentale Aspekte seiner Arbeit",
    ],
  },
  "https://www.der-postillon.com/2014/01/newsticker-558.html": {
    authors: "nib, ?, bpy, spu, nan, xyu, cha",
  },
  "https://www.der-postillon.com/2013/09/newsticker-500-xxl-edition-106.html": {
    authors:
      "sjs, ess, fla, tod, ax, marc, mig, rk, pta, pet,kmü, tim, tim, dne, tim/ste, par",
  },
  "https://www.der-postillon.com/2013/04/newsticker-449.html": {
    authors: "marc/arne/fis, hel, fla, sdr, rk, rjk, tim",
    tickers: [
      "Shitstorm: Internetgemeinde wütend nach Explosion in Klärwerk",
      "Sind miteinander nicht warm geworden: Kannibalenopfer werden getrennt gekocht",
      "Beschützerinstinkt: Leibwächterin wehrt Buttersäureangriff ab",
      "Arbeitet rund um die Uhr: Kirchenrestaurateur vollkommen erschöpft",
      "Bei Lichte betrachtet: Dark Room ist auch nur ein Zimmer",
      "Da bleibt kein Auge trocken: Taucher finden Grund zum Lachen",
      "Wenig Arbeit wegen geringer Qualifikation: Folterknecht kann nur Däumchendrehen",
    ],
  },

  "https://www.der-postillon.com/2012/12/newsticker-392.html": {
    authors: "dlo, frcx, tim, marc, hct, ?, jsm",
    tickers: [
      "Knebelvertrag: Pornodarstellerin muss bei Bondagefilmen mitspielen",
      "Überführt: Autoschieber hatte Kontakte ins Ausland",
      "Einfach nur krank: Nachlässiger Arzt stellt Pauschaldiagnosen",
      "Kommt nicht mehr klar: Junkie geht nur noch high zur Arbeit",
      "Nicht sein Bier: Braumeister ist Konkurrenz egal",
      "Hunderte Franken verloren: Schweizer Menschenhändler macht großen Verlust",
      "Was für ein Honk: Mann betätigt wiederholt laute Hupe",
    ],
  },
  "https://www.der-postillon.com/2012/09/newsticker-362.html": {
    authors: "marc, dav, ?, ste, db, dady, burg",
  },
  "https://www.der-postillon.com/2012/06/newsticker-319.html": {
    authors: "?, ?, marc, ?, ?, evw, ast",
  },
  "https://www.der-postillon.com/2012/05/newsticker-314.html": {
    authors: "bjö, ?, tim, ?, ?, arc, marc",
  },
  "https://www.der-postillon.com/2011/07/newsticker-193.html": {
    tickers: [
      "Kartograph geil: Weiße Flecken auf der Landkarte",
      'Fleischersatz: "Tofu ist Scheiße!"',
      "Manila morgens nass: Sinnloses Anagramm",
      "++x Doppelpunkt verhaftet Soll Plus umgelegt haben +++",
      "Knöchel verstaucht: Rockstar kann nicht auftreten",
      "Steht in der Gegend: Rum",
    ],
  },
  "https://www.der-postillon.com/2011/02/newsticker-143.html": {
    authors: "ano, lot, svl, tbe, tbe, ucn",
  },
  "https://www.der-postillon.com/2010/02/vancouver-2010-der-olympia-newsticker.html":
    {
      num: "59b",
    },
  "https://www.der-postillon.com/2009/03/zeitumstellungsticker.html": {
    authors: "ssi,ssi,ssi,ssi",
    num: 9,
  },
  "https://www.der-postillon.com/2022/04/muskticker-1.html": {
    num: 1975,
  },
  "https://www.der-postillon.com/2009/04/newsticker-10.html": {
    tickers: [
      "Arm: Die Kirchenmäuse des Kölner Doms sammeln für eine Käseglocke",
      "Schmerzhaft: Matrose verliert Auge durch Mövenpick",
      "So ein Twixer: Mr. Tom snickert Kit-Kat an den Mars und bekommt voll in die Nuts",
      "--- Wegen Newsticker: sämtliche Pluszeichen aufgebraucht ---",
    ],
  },

  "https://www.der-postillon.com/2009/02/newstickernewstickernewsti.html": {
    num: 1,
  },
};

const scheduledURLs = [
  // Uncomment one or more to test
  // "https://www.der-postillon.com/2021/10/newsticker-1710.html",
  // "https://www.der-postillon.com/2020/12/newsticker-1585.html",
  // "https://www.der-postillon.com/2018/01/newsticker-1149.html",
  // "https://www.der-postillon.com/2017/07/newsticker-1078.html",
  // "https://www.der-postillon.com/2017/05/newsticker-1053.html",
  // "https://www.der-postillon.com/2017/04/newsticker-1040.html",
  // "https://www.der-postillon.com/2017/04/newsticker-1032.html",
  // "https://www.der-postillon.com/2017/03/newsticker-1021.html",
  // "https://www.der-postillon.com/2017/01/newsticker-1003.html",
  // "https://www.der-postillon.com/2017/01/newsticker-1000.html",
  // "https://www.der-postillon.com/2016/12/newsticker-993.html",
  // "https://www.der-postillon.com/2016/12/newsticker-983.html",
  // "https://www.der-postillon.com/2016/11/newsticker-977.html",
  // "https://www.der-postillon.com/2016/11/newsticker-975.html",
  // "https://www.der-postillon.com/2016/10/newsticker-965.html",
  // "https://www.der-postillon.com/2016/10/newsticker-960.html",
  // "https://www.der-postillon.com/2016/08/newsticker-943.html",
  // "https://www.der-postillon.com/2016/08/newsticker-937.html",
  // "https://www.der-postillon.com/2016/08/newsticker-933.html",
  // "https://www.der-postillon.com/2015/07/newsticker-774.html",
  // "https://www.der-postillon.com/2015/01/newsticker-704.html",
  // "https://www.der-postillon.com/2014/04/newsticker-599.html",
  // "https://www.der-postillon.com/2014/01/newsticker-558.html",
  // "https://www.der-postillon.com/2013/09/newsticker-500-xxl-edition-106.html",
  // "https://www.der-postillon.com/2013/04/newsticker-449.html",
  // "https://www.der-postillon.com/2013/04/newsticker-439.html",
  // "https://www.der-postillon.com/2012/12/newsticker-392.html",
  // "https://www.der-postillon.com/2012/09/newsticker-362.html",
  // "https://www.der-postillon.com/2012/06/newsticker-319.html",
  // "https://www.der-postillon.com/2012/05/newsticker-314.html",
  // "https://www.der-postillon.com/2011/07/newsticker-193.html",
  // "https://www.der-postillon.com/2011/02/newsticker-143.html",
  // "https://www.der-postillon.com/2010/11/castor-transport-2010-die-highlights-im.html",
  // "https://www.der-postillon.com/2010/09/newsticker-100-das-jubilaum.html",
  // "https://www.der-postillon.com/2010/06/postillon-liveticker-npd-parteitag-in.html",
  // "https://www.der-postillon.com/2009/04/newsticker-10.html",
  // "https://www.der-postillon.com/2009/03/zeitumstellungsticker.html",
  // "https://www.der-postillon.com/2023/05/newsticker-1949.html",
  // "https://www.der-postillon.com/2012/03/newsticker-286.html",
  // "https://www.der-postillon.com/2009/03/newsticker-5.html",
  // "https://www.der-postillon.com/2010/05/newsticker-71_27.html",
  // "https://www.der-postillon.com/2022/04/muskticker-1.html",
  // "https://www.der-postillon.com/2023/05/newsticker-1947.html",
  // "https://www.der-postillon.com/2010/09/newsticker-100-das-jubilaum.html",
  // "https://www.der-postillon.com/2021/07/newsticker-1677.html",
  // "https://www.der-postillon.com/2010/02/vancouver-2010-der-olympia-newsticker.html",
];

const startURL = "https://www.der-postillon.com/search/label/Newsticker";

const browser = await puppeteer.launch({
  headless: displayBrowser ? false : "new",
});
const page = await browser.newPage();

await page.setRequestInterception(true);
page.on("request", (request) => {
  if (request.resourceType() === "image") request.abort();
  else request.continue();
});

/**
 * Load existing tickers and already fetched URLs
 */
const alreadyFetched = JSON.parse(readFileSync("./alreadyFetched.json"));

const tickers = JSON.parse(
  (fs.readFileSync("./tickers.js") + "").replace("export const tickers =", "")
);

const problematicTickers = JSON.parse(
  readFileSync("./problematicTickers.json")
);

if (clearEverything) {
  tickers.splice(0, tickers.length);
  alreadyFetched.splice(0, alreadyFetched.length);
  problematicTickers.splice(0, problematicTickers.length);
}

const currentContents = tickers.map((t) => t.content);

const findOlderPageLink = async () =>
  page.evaluate(
    () =>
      document.querySelector("a.blog-pager-older-link")?.attributes["data-load"]
        .nodeValue
  );

const extractImage = async () =>
  page.evaluate(
    () =>
      document.querySelectorAll("head > meta[property='og:image']")[0]?.content
  );

const fetchTickerArticleLinks = async () =>
  page.evaluate(() => {
    const titles = document.querySelectorAll("h2.entry-title > a");
    const result = [];
    titles.forEach((title) => result.push(title.href));
    return result;
  });

const fetchTickers = async () => {
  return page.evaluate(() => {
    const innerTickers = [];

    const text = document.querySelector("div.post-body").innerText;
    text.split("\n").forEach((ticker) => innerTickers.push(String(ticker)));
    return innerTickers;
  });
};

const reg_newsticker_plain = /[\+]+\+\+(.*)[\+]+\+\+/gm;
const reg_number_from_url =
  /https:\/\/www\.der-postillon\.com\/[0-9]{4}\/[0-9]{2}\/[^0-9]*([0-9]*)[_0-9a-z-]*\.html/gm;

const mainLoop = async () => {
  // 1. url = startURL
  // 2. goto url;
  // 3. fetch URLs and add them to scheduled
  // 4. if present load next page i.e. goto 2
  // 5. if not present start loading and processing scheduled pages
  let count = 0;

  let url = startURL;

  const noTest = scheduledURLs.length === 0;

  if (noTest)
    while (url !== undefined) {
      if (
        alreadyFetched.indexOf(url) < 0 &&
        scheduledURLs.length < maximumNumberOfPages
      ) {
        console.log("Visiting ", url);
        await page.goto(url);
        if (url !== startURL) alreadyFetched.push(url);

        (await fetchTickerArticleLinks()).forEach((url) =>
          scheduledURLs.push(url)
        );
        url = await findOlderPageLink(count++);
      } else {
        url = undefined;
      }
    }

  for (url of scheduledURLs) {
    if (alreadyFetched.indexOf(url) >= 0) continue;
    alreadyFetched.push(url);
    console.log("Calling ", url);
    const currentTickers = [];
    await page.goto(url);
    if (exceptionalStuffByUrl[url]?.tickers) {
      exceptionalStuffByUrl[url].tickers.forEach((ticker) =>
        currentTickers.push({ content: ticker.trim(), url })
      );
    } else {
      (await fetchTickers()).forEach((ticker) => {
        regex(ticker.trim(), reg_newsticker_plain, (text) => {
          if (text[0].trim() !== "Newsticker")
            currentTickers.push({ content: text[0].trim(), url });
        });
      });
    }
    let authors = "";
    if (exceptionalStuffByUrl[url]?.authors) {
      authors = [exceptionalStuffByUrl[url].authors];
    } else {
      authors = await page.evaluate(() => {
        const spans = document.querySelectorAll("#post-body span");
        let potentials = [];
        spans.forEach((span) =>
          span.style["font-size"] === "x-small"
            ? potentials.push((str = span.innerText))
            : null
        );
        return potentials; //:nth-child(10)
      });
    }
    authors
      .find((str) => countStr(str, ",") === currentTickers.length - 1)
      ?.split(",")
      ?.map((e) => e.trim())
      ?.forEach((author, idx) =>
        currentTickers[idx]
          ? (currentTickers[idx].creators = author.split("/"))
          : console.log(currentTickers.length, authors.split(",").length)
      );

    if (exceptionalStuffByUrl[url]?.num) {
      currentTickers.forEach((t) => (t.num = exceptionalStuffByUrl[url].num));
    } else {
      regex(url, reg_number_from_url, (num) =>
        currentTickers.forEach((t) => (t.num = num[0]))
      );
    }
    if (
      authors
        .find((str) => countStr(str, ",") === currentTickers.length - 1)
        ?.split(",")?.length !== currentTickers.length
    ) {
      console.log("Error extracting authors " + url);
      console.log(authors);
      problematicTickers.push(
        "Error extracting authors " + url + " " + authors
      );
    }

    if (currentTickers[0]) {
      currentTickers[0].image = await extractImage();
    }

    /**
     * For the tickers that have been
     * extracted check if they already exist, otherwise add them to the results.
     */
    currentTickers
      .filter((e) => currentContents.indexOf(e.content) < 0)
      .forEach((ct) => tickers.push(ct));
  }

  console.log("Result", tickers);
};

await mainLoop();

fs.writeFileSync(
  "tickers.js",
  "export const tickers = \n" + JSON.stringify(tickers, null, 1)
);

fs.writeFileSync(
  "alreadyFetched.json",
  JSON.stringify(alreadyFetched, null, 1)
);

fs.writeFileSync(
  "problematicTickers.json",
  JSON.stringify(problematicTickers, null, 2)
);

browser.close();
