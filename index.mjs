import puppeteer from "puppeteer";
import regex from "./regex.mjs";
import fs, { readFileSync } from "fs";
import { exceptionalStuffByUrl } from "./exceptionalStuffByUrl.mjs";
import { a } from "tagl-mithril";

let clearEverything = false;
const displayBrowser = false;

const maximumNumberOfPages = 1e100;

const startURL = "https://www.der-postillon.com/search/label/Newsticker";
const startURLBE = "https://www.the-postillon.com/search/label/Newsticker";

const countStr = (haystack, needle) =>
  haystack.split("").filter((e) => e === needle).length;

const yearAndMonthFromUrl = (url) => {
  const match = url.match(
    /https:\/\/www\....-postillon\.com\/(\d{4})\/(\d{2})\/.*$/
  );
  return {
    year: match ? parseInt(match[1], 10) : 0,
    month: match ? parseInt(match[2], 10) : 0,
  };
};
const yearAndMonthFromOlderUrl = (url) => {
  if (!url) return { year: 0, month: 0 };
  const match = url.match(/updated-max=(\d{4})\/(\d{2})\/.*$/);
  return {
    year: match ? parseInt(match[1], 10) : 0,
    month: match ? parseInt(match[2], 10) : 0,
  };
};

const browser = await puppeteer.launch({
  headless: displayBrowser ? false : "new",
  args: ["--no-sandbox"],
});

const page = await browser.newPage();

/** This makes loading faster, don't load unneeded images */
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
let tickers = JSON.parse(
  (fs.readFileSync("./tickers.js") + "").replace("export const tickers =", "")
);

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

console.log(
  JSON.stringify(tickers.map((ticker) => +ticker.num).sort((a, b) => -a + b)[0])
);

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
    }
    return innerTickers;
  });
};

const use = (v, f) => f(v);

const reg_newsticker_plain = /[\+]+\+\+(.*)[\+]+\+\+/gm;
const reg_number_from_url =
  /https:\/\/www\....-postillon\.com\/[0-9]{4}\/[0-9]{2}\/[^0-9]*([0-9]*)[_0-9a-z-]*\.html/gm;
const leftPad = (str, n) => str.toString().padStart(n, "0");

tickers.sort((a, b) => {
  const aYearMonth = yearAndMonthFromUrl(a.url);
  const bYearMonth = yearAndMonthFromUrl(b.url);
  if (aYearMonth.year !== bYearMonth.year) {
    return bYearMonth.year - aYearMonth.year; // Sort by year descending
  }
  return bYearMonth.month - aYearMonth.month; // Sort by month descending
});

const last_ticker_year_month = tickers[0]
  ? yearAndMonthFromUrl(tickers[0].url)
  : { year: 0, month: 0 };

const current_year = last_ticker_year_month.year || new Date().getFullYear();
const current_month = last_ticker_year_month.month || new Date().getMonth() + 1; // Months are 0-indexed in JavaScript

const isCurrentYearAndMonth = ({ year, month }) =>
  year >= current_year && month >= current_month;

console.log(last_ticker_year_month)
console.log(`Current year: ${current_year}, Current month: ${current_month}`);

tickers = tickers.filter((ticker) => {
  const { year, month } = yearAndMonthFromUrl(ticker.url);
  return !isCurrentYearAndMonth({ year, month });
});
const determineURLsToProcess = async (url) => {
  const urls = [];
  while (url !== undefined) {
    await page.goto(url);
    (await fetchTickerArticleLinks()).forEach((url) =>
      isCurrentYearAndMonth(yearAndMonthFromUrl(url))
        ? urls.push(url)
        : undefined
    );
    console.log("Found URLs: ", urls.length, urls);
    url = await findOlderPageLink();
    url = isCurrentYearAndMonth(yearAndMonthFromOlderUrl(url))
      ? url
      : undefined;
  }
  return urls.filter((url) => url.indexOf("search/label") < 0);
};

const mainLoop = async (cStartURL) => {
  // 1. url = startURL
  // 2. goto url;
  // 3. fetch URLs and add them to scheduled
  // 4. if present load next page i.e. goto 2
  // 5. if not present start loading and processing scheduled pages
  let url = cStartURL;

  const scheduledURLs_ = Object.keys(
    (await determineURLsToProcess(url)).reduce(
      (acc, url) => Object.assign(acc, { [url]: (acc[url] || 0) + 1 }),
      {}
    )
  );
  for (url of scheduledURLs_) {
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
    console.log("Found num: ", currentTickers[0]?.num, " for ", url);
    if (
      authors
        .find((str) => countStr(str, ",") === currentTickers.length - 1)
        ?.split(",")?.length !== currentTickers.length
    ) {
      console.log("Error extracting authors " + url);
      console.log(authors);
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
};

if (true) {
  await mainLoop(startURL);
  await mainLoop(startURLBE);
}

tickers = tickers.sort((a,b) => +a.num > +b.num ? -1 : 1);

fs.writeFileSync(
  "tickers.js",
  "export const tickers = \n" + JSON.stringify(tickers, null, 1)
);

browser.close();
