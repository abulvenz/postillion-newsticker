import puppeteer from "puppeteer";
import regex from "./regex.mjs";
import fs, { readFileSync } from "fs";
import { exceptionalStuffByUrl } from "./exceptionalStuffByUrl.mjs";

const clearEverything = false;
const displayBrowser = false;

const maximumNumberOfPages = 1e100;

const startURL = "https://www.der-postillon.com/search/label/Newsticker";
const startURLBE = "https://www.the-postillon.com/search/label/Newsticker";

const countStr = (haystack, needle) =>
  haystack.split("").filter((e) => e === needle).length;

const browser = await puppeteer.launch({
  headless: displayBrowser ? false : "new",
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

const urls = tickers.map((t) => t.url);

const comment_urls = await urls.map(async (url, i) => {
  if (i < 1) {
    console.log("Fetching", url);
    await page.goto(url);
    await page.click("#loadCommentButton");
    await page.waitForSelector("div#disqus_thread>iframe");

    console.log(page.select("div#disqus_thread>iframe"));

    return;
  }

  return undefined;
});

await Promise.all(comment_urls);

console.log(comment_urls);

browser.close();
