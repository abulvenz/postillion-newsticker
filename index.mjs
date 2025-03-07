import puppeteer from "puppeteer";
import regex from "./regex.mjs";
import fs, { readFileSync } from "fs";
import { exceptionalStuffByUrl } from "./exceptionalStuffByUrl.mjs";

let clearEverything = true;
const displayBrowser = false;

const maximumNumberOfPages = 1e100;

const startURL = "https://www.der-postillon.com/search/label/Newsticker";
const startURLBE = "https://www.the-postillon.com/search/label/Newsticker";

const countStr = (haystack, needle) =>
  haystack.split("").filter((e) => e === needle).length;

if (clearEverything === false) {
  const now = new Date();
  clearEverything = now.getDay() === 1 && now.getDate() <= 7;
}

const scheduledURLs = [
  // Uncomment one or more to test
  // "https://www.der-postillon.com/2024/12/newsticker-2179.html"
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

const browser = await puppeteer.launch({
  headless: displayBrowser ? false : "new",
  args: ["--no-sandbox"],
});

const page = await browser.newPage();

await page.setRequestInterception(true);
page.on("request", (request) => {
  if (
    request.resourceType() === "image" ||
    !(
      request.url().startsWith("https://www.der-post") ||
      request.url().startsWith("https://www.the-post")
    )
  )
    request.abort();
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
        ?.nodeValue
  );

const extractImage = async () =>
  page.evaluate(
    () =>
      document.querySelectorAll("head > meta[property='og:image']")[0]?.content
  );

const fetchTickerArticleLinks = async () =>
  page.evaluate(() => {
    const titles = document.querySelectorAll(".entry-title > a");
    const result = [];
    titles.forEach((title) => result.push(title.href));
    return result;
  });

const fetchTickers = async () => {
  return page.evaluate(() => {
    const innerTickers = [];
    try {
      const text = document.querySelector("div.post-body").innerText;
      if (text) {
        text.split("\n").forEach((ticker) => innerTickers.push(String(ticker)));
      } else {
        console.log(
          "STRANGE EMPTY BODY",
          document.querySelector("div.post-body")
        );
      }
    } catch (error) {
      console.log(
        "STRANGE EMPTY BODY",
        document.querySelector("div.post-body")
      );
      // problematicTickers.push("STRANGE EMPTY BODY " + url);
    }
    return innerTickers;
  });
};

const reg_newsticker_plain = /[\+]+\+\+(.*)[\+]+\+\+/gm;
const reg_number_from_url =
  /https:\/\/www\....-postillon\.com\/[0-9]{4}\/[0-9]{2}\/[^0-9]*([0-9]*)[_0-9a-z-]*\.html/gm;

const mainLoop = async (cStartURL) => {
  // 1. url = startURL
  // 2. goto url;
  // 3. fetch URLs and add them to scheduled
  // 4. if present load next page i.e. goto 2
  // 5. if not present start loading and processing scheduled pages
  let count = 0;

  let url = cStartURL;

  const noTest = scheduledURLs.length === 0;

  if (noTest)
    while (url !== undefined) {
      if (
        alreadyFetched.indexOf(url) < 0 &&
        scheduledURLs.length < maximumNumberOfPages
      ) {
        console.log("Visiting ", url);
        await page.goto(url);
        if (url !== startURL && url !== startURLBE) alreadyFetched.push(url);

        (await fetchTickerArticleLinks()).forEach((url) =>
          scheduledURLs.push(url)
        );
        url = await findOlderPageLink(count++);
      } else {
        url = undefined;
      }
    }

  for (url of scheduledURLs) {
    if (noTest && alreadyFetched.indexOf(url) >= 0) continue;
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
        const spans = document.querySelectorAll(".post-body span");
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
        "Error extracting authors " + url + " " + authors + " "
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
  scheduledURLs.splice(0, scheduledURLs.length);
};

if (scheduledURLs.length === 0) {
  await mainLoop(startURL);
  await mainLoop(startURLBE);
} else {
  await mainLoop(startURL);
}

fs.writeFileSync("tickers.json", JSON.stringify(tickers, null, 1));

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
