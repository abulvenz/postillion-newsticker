import puppeteer from "puppeteer";
import regex from "./regex.mjs";
import fs, { readFileSync } from "fs";
import { exceptionalStuffByUrl } from "./exceptionalStuffByUrl.mjs";
import { a } from "tagl-mithril";

console.log("🚀 Script started");

const displayBrowser = false;

const startURL =
  "https://disqus.com/home/discussion/postillon/newsticker_2269/";

const countStr = (haystack, needle) =>
  haystack.split("").filter((e) => e === needle).length;

const range = (start, end) => {
  const arr = [];
  for (let i = start; i <= end; i++) {
    arr.push(i);
  }
  return arr;
};

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
  const match = url.match(/.*updated-max=(\d{4})-(\d{2}).*$/);
  console.log("yearAndMonthFromOlderUrl", url, match);
  return {
    year: match ? parseInt(match[1], 10) : 0,
    month: match ? parseInt(match[2], 10) : 0,
  };
};

const browser = await puppeteer.launch({
  headless: displayBrowser ? false : "new",
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--disable-gpu",
    "--single-process",
    "--disable-setuid-sandbox",
  ],
});

const page = await browser.newPage();

console.log("🚀 Browser launched");

/** This makes loading faster, don't load unneeded images */
await page.setRequestInterception(false);
if (false)
  page.on("request", (request) => {
    if (
      request.resourceType() === "image" ||
      !(
        request.url().startsWith("https://disqus") ||
        request.url().startsWith("https://www.the-post")
      )
    )
      request.abort();
    else request.continue();
  });

/**
 * Load existing tickers and already fetched URLs
 */
let tickers = [];

const use = (v, f) => f(v);

const reg_newsticker_plain = /[\+]+\+\+(.*)[\+]+\+\+/gm;
const reg_number_from_url =
  /https:\/\/www\....-postillon\.com\/[0-9]{4}\/[0-9]{2}\/[^0-9]*([0-9]*)[_0-9a-z-]*\.html/gm;
const leftPad = (str, n) => str.toString().padStart(n, "0");

const mainLoop = async (cStartURL) => {
  // 1. url = startURL
  // 2. goto url;
  // 3. fetch URLs and add them to scheduled
  // 4. if present load next page i.e. goto 2
  // 5. if not present start loading and processing scheduled pages
  let url = cStartURL;

  const scheduledURLs_ = range(2169, 2269).map(
    (i) => `https://disqus.com/home/discussion/postillon/newsticker_${i}/`
  );

  // Object.keys(
  //   (await determineURLsToProcess(url)).reduce(
  //     (acc, url) => Object.assign(acc, { [url]: (acc[url] || 0) + 1 }),
  //     {}
  //   )
  // );
  for (url of scheduledURLs_) {
    console.log("Calling ", url);
    // const currentTickers = [];
    const resp = await page.goto(url);

    if (!resp || !resp.ok()) {
      console.error("Failed to load URL:", url, resp);
      continue;
    }

    await page.waitForSelector(".osano-cm-denyAll");
    await page.click(".osano-cm-denyAll");

    const iframeElement = await page.waitForSelector(
      'iframe[src*="disqus.com/embed"]'
    );
    const frame = await iframeElement.contentFrame();

    const new_tickers = await frame.evaluate(async () => {
      const currentTickers = [];
      const selector = ".load-more-refresh__button";

      function isVisible(el) {
        const style = window.getComputedStyle(el);
        console.log("Checking visibility for", el, style);
        return (
          style &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          el.offsetParent !== null
        );
      }

      async function sleep(ms) {
        return new Promise((r) => setTimeout(r, ms));
      }

      await sleep(1000);
      let button = document.querySelector(selector);

      if (button) {
        console.log("Found button", button, isVisible(button), button.disabled);
      }
      while (button && isVisible(button) && !button.disabled) {
        console.log("Clicking button", button);
        button.click();
        await sleep(1000);
        button = document.querySelector(selector);
        await sleep(1000);
        if (button) {
          console.log("Found button", button);
        } else {
          console.log("Button not found, exiting loop");
        }
      }

      const reg_newsticker_plain = /[\+]+\+\+(.*)[\+]+\+\+/gm;
      function regex(str, regex, cb) {
        let m;
        let count = 0;
        // console.error("In regex");
        while ((m = regex.exec(str)) !== null) {
          // console.error("In while");
          // This is necessary to avoid infinite loops with zero-width matches
          if (m.index === regex.lastIndex) {
            regex.lastIndex++;
          }

          // The result can be accessed through the `m`-variable.

          const results = [];

          m.forEach((match, groupIndex) => {
            results[groupIndex] = match;
          });

          results.shift();

          // console.error("FOUND: ", results);

          cb(results, count++);
        }
      }
      const posts = document.querySelectorAll(".post-content");

      for (const post of posts) {
        const author = post.querySelector(".author a")?.innerText;
        const ticker = post.querySelector(".post-message").innerText;
        const likes =
          +post.querySelector('[data-role="likes"]')?.innerText?.trim() || "0";
        const dislikes =
          post.querySelector('[data-role="dislikes"]')?.innerText?.trim() ||
          "0"; // Autorennen der Autorinnen deren Autowonnen von den Autos rannen

        regex(ticker.trim(), reg_newsticker_plain, (text) => {
          if (text[0].trim() !== "Newsticker")
            currentTickers.push({
              content: text[0].trim(),
              nnn: posts.length,
              author,
              likes,
            });
        });
      }
      console.log("Found posts:", posts);

      window.scrollTo(0, document.body.scrollHeight);
      return currentTickers;
    });
    new_tickers.forEach((ticker) => {
      ticker.url = url;
    });
    console.log(`Found tickers: ${new_tickers.length}`, new_tickers);
    tickers = tickers.concat(new_tickers);
  }
};

if (true) {
  await mainLoop(startURL);
}

tickers = tickers.sort((a, b) => (+a.num > +b.num ? -1 : 1));

fs.writeFileSync(
  "tickers.js",
  "export const tickers = \n" + JSON.stringify(tickers, null, 1)
);

browser.close();
