import puppeteer from "puppeteer";
import regex from "./regex.mjs";
import fs, { readFileSync } from "fs";

const clearEverything = true;
const displayBrowser = false;

const maximumNumberOfPages = 1e100;

const scheduledURLs = [
  // Uncomment one or more to test
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

if (clearEverything) {
  tickers.splice(0, tickers.length);
  alreadyFetched.splice(0, alreadyFetched.length);
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

const problematicTickers = [];

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
    (await fetchTickers()).forEach((ticker) => {
      regex(ticker.trim(), reg_newsticker_plain, (text) => {
        if (text[0].trim() !== "Newsticker")
          currentTickers.push({ content: text[0].trim(), url });
      });
    });
    const authors = await page.evaluate(() => {
      const spans = document.querySelectorAll("#post-body span");
      let str = "";
      spans.forEach((span) =>
        span.style["font-size"] === "x-small" ? (str = span.innerText) : null
      );
      return str; //:nth-child(10)
    });
    authors
      .split(",")
      .map((e) => e.trim())
      .forEach((author, idx) =>
        currentTickers[idx]
          ? (currentTickers[idx].creators = author.split("/"))
          : console.log(currentTickers.length, authors.split(",").length)
      );

    regex(url, reg_number_from_url, (num) =>
      currentTickers.forEach((t) => (t.num = num[0]))
    );

    if (authors.split(",").length !== currentTickers.length) {
      console.log("Error extracting authors " + url);
      problematicTickers.push("Error extracting authors " + url);
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
