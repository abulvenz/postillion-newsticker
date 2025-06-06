import puppeteer from "puppeteer";
import regex from "./regex.mjs";
import fs, { readFileSync, writeFileSync } from "fs";
import { exceptionalStuffByUrl } from "./exceptionalStuffByUrl.mjs";

const clearEverything = false;
const displayBrowser = false;
const maximumNumberOfPages = Infinity;

const startURLs = [
  "https://www.der-postillon.com/search/label/Newsticker",
  "https://www.the-postillon.com/search/label/Newsticker",
];

const scheduledURLs = [];

const browser = await puppeteer.launch({
  headless: displayBrowser ? false : "new",
});
const page = await browser.newPage();

await page.setRequestInterception(true);
page.on("request", (request) => {
  const url = request.url();
  const isPostillonURL =
    url.startsWith("https://www.der-postillon.com") ||
    url.startsWith("https://www.the-postillon.com");
  if (request.resourceType() === "image" || !isPostillonURL) {
    request.abort();
  } else {
    request.continue();
  }
});

const alreadyFetched = JSON.parse(readFileSync("./alreadyFetched.json"));
const tickers = JSON.parse(
  (fs.readFileSync("./tickers.js") + "").replace("export const tickers =", "")
);
const problematicTickers = JSON.parse(
  fs.readFileSync("./problematicTickers.json")
);

if (clearEverything) {
  tickers.length = 0;
  alreadyFetched.length = 0;
  problematicTickers.length = 0;
}

const currentContents = tickers.map((t) => t.content);

const findOlderPageLink = async () =>
  await page.evaluate(
    () =>
      document.querySelector("a.blog-pager-older-link")?.attributes["data-load"]
        ?.nodeValue
  );

const extractImage = async () =>
  await page.evaluate(
    () =>
      document.querySelectorAll("head > meta[property='og:image']")[0]?.content
  );

const fetchTickerArticleLinks = async () =>
  await page.evaluate(() =>
    Array.from(
      document.querySelectorAll(".entry-title > a"),
      (title) => title.href
    )
  );

const fetchTickers = async () => {
  const innerTickers = await page.evaluate(() => {
    const text = document.querySelector("div.post-body").innerText;
    return text.split("\n").map((ticker) => ticker.trim());
  });
  return innerTickers.filter((ticker) => ticker !== "Newsticker");
};

const regNewstickerPlain = /[\+]+\+\+(.*)[\+]+\+\+/gm;
const regNumberFromURL =
  /https:\/\/www\....-postillon\.com\/[0-9]{4}\/[0-9]{2}\/[^0-9]*([0-9]*)[_0-9a-z-]*\.html/gm;

const processTickers = (tickers, url, authors) => {
  const currentTickers = [];
  tickers.forEach((ticker) => {
    regex(ticker, regNewstickerPlain, (text) => {
      if (text[0].trim() !== "Newsticker") {
        currentTickers.push({ content: text[0].trim(), url });
      }
    });
  });

  authors
    .find((str) => countStr(str, ",") === currentTickers.length - 1)
    ?.split(",")
    .map((author) => author.trim())
    .forEach((author, idx) => {
      if (currentTickers[idx]) {
        currentTickers[idx].creators = author.split("/");
      }
    });

  regex(url, regNumberFromURL, (num) => {
    currentTickers.forEach((t) => (t.num = num[0]));
  });

  if (currentTickers.length !== authors.split(",").length) {
    console.log("Error extracting authors: " + url);
    console.log(authors);
    problematicTickers.push("Error extracting authors: " + url + " " + authors);
  }

  return currentTickers;
};

const fetchAndProcessTickers = async (url) => {
  if (alreadyFetched.includes(url)) return;
  console.log("Calling", url);
  alreadyFetched.push(url);

  await page.goto(url);

  if (exceptionalStuffByUrl[url]?.tickers) {
    const { tickers, authors, num } = exceptionalStuffByUrl[url];
    const currentTickers = processTickers(tickers, url, [authors]);
    currentTickers.forEach((t) => (t.num = num));
    return currentTickers;
  } else {
    const tickers = await fetchTickers();
    const authors = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll(".post-body span"));
      const potentials = spans
        .filter((span) => span.style["font-size"] === "x-small")
        .map((span) => span.innerText);
      return potentials;
    });
    return processTickers(tickers, url, authors);
  }
};

const mainLoop = async (startURL) => {
  let url = startURL;
  let count = 0;

  while (url !== undefined) {
    if (
      alreadyFetched.includes(url) ||
      scheduledURLs.length >= maximumNumberOfPages
    ) {
      url = undefined;
      continue;
    }

    console.log("Visiting", url);
    await page.goto(url);

    if (url !== startURLs[0] && url !== startURLs[1]) {
      alreadyFetched.push(url);
    }

    const links = await fetchTickerArticleLinks();
    scheduledURLs.push(...links);

    url = await findOlderPageLink(count++);
  }

  const uniqueURLs = [...new Set(scheduledURLs)];

  for (const url of uniqueURLs) {
    const currentTickers = await fetchAndProcessTickers(url);
    currentTickers.forEach((ticker) => {
      if (!currentContents.includes(ticker.content)) {
        tickers.push(ticker);
      }
    });
  }

  console.log("Result", tickers);
};

for (const startURL of startURLs) {
  await mainLoop(startURL);
}

writeFileSync(
  "tickers.js",
  "export const tickers = \n" + JSON.stringify(tickers, null, 1)
);
writeFileSync("alreadyFetched.json", JSON.stringify(alreadyFetched, null, 1));
writeFileSync(
  "problematicTickers.json",
  JSON.stringify(problematicTickers, null, 2)
);

await browser.close();
