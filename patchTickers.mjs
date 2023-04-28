import fs, { readFileSync } from "fs";
import regex from "./regex.mjs";

const resultingTickers = JSON.parse(
  (fs.readFileSync("./tickers.js") + "").replace("export const tickers =", "")
);

const reg_sub_url_number =
  /https:\/\/www.der-postillon.com\/[0-9]+\/[0-9]+\/(news|musk)ticker-([0-9]+)[_\-a-z0-9]*.html/gm;

resultingTickers
  // .filter((ticker) => !ticker.num)
  .map((ticker) => {
    regex(ticker.url, reg_sub_url_number, (frags) =>
      console.log(
        (ticker.num = frags[0] === "musk" ? "musk" + frags[1] : frags[1])
      )
    );
    return ticker;
  })
  .forEach((ticker) => console.log(ticker.num, ticker.url, ticker.content));

fs.writeFileSync(
  "./tickers.js",
  "export const tickers = \n" + JSON.stringify(resultingTickers, null, 1)
);
