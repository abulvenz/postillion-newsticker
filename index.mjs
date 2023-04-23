import http from "https";
import regex from "./regex.mjs";
import fs from "fs";

const fetchAsString = (url, cb, errCallback) => {
  http.get(url, (res) => {
    let rawData = "";

    res.on("data", (chunk) => {
      rawData += chunk;
    });

    res.on("end", () => cb(rawData));

    res.on("error", errCallback);
  });
};

const reg_sub_url =
  /(https:\/\/www.der-postillon.com\/[0-9]+\/[0-9]+\/(news|musk)ticker-[0-9]+[\-a-z0-9A-Z]*.html)/gm;

//const reg_sub_url =
//  /(https:\/\/www.der-postillon.com\/[0-9]+\/[0-9]+\/newsticker-[0-9]+\.html)/gm;

const reg_sub_url_number =
  /https:\/\/www.der-postillon.com\/[0-9]+\/[0-9]+\/newsticker-([0-9]+)[\-a-z0-9]*.html/gm;

const reg_next_overview_link = /data-load=\'([^\'].*)/gm;

const reg_newsticker = /<p>\+\+\+ (.*) \+\+\+<\/p>/gm;
const reg_newsticker_plain = /\+\+\+ (.*) \+\+\+<br \/>/gm;

const urlsToFetch = [];

let done = false;

const resultingTickers = [];

const add = (url, num, content) => resultingTickers.push({ url, num, content });

const timer = setInterval(() => {
  if (urlsToFetch.length > 0) {
    const nextPageURL = urlsToFetch.shift();

    console.error("FETCHING ", nextPageURL);
    let num = 0;
    regex(nextPageURL, reg_sub_url_number, (m) => (num = m[0]));

    fetchAsString(
      nextPageURL,
      (pageString) => {
        regex(pageString, reg_newsticker, (newsTicker) =>
          add(nextPageURL, num, newsTicker[0])
        );
        regex(pageString, reg_newsticker_plain, (newsTicker) =>
          add(nextPageURL, num, newsTicker[0])
        );
      },
      console.error
    );
  } else {
    if (done) {
      clearInterval(timer);
      fs.writeFileSync(
        "tickers.js",
        "export const tickers =" + JSON.stringify(resultingTickers)
      );
    }
  }
  console.error("Pages to retrieve", urlsToFetch.length);
}, 500);

let count = 0;

const getThis = (
  url = `https://www.der-postillon.com/search/label/Newsticker`
) =>
  fetchAsString(
    url,
    (res) => {
      let newUrl = "";
      console.error("Running regex");
      regex(res, reg_sub_url, (m) => {
        if (urlsToFetch.indexOf(m[0]) < 0) urlsToFetch.push(m[0]);
      });
      regex(res, reg_next_overview_link, (m) => (newUrl = m[0]));
      // console.log(res);
      console.error("Found so far", urlsToFetch.length, " URLS");
      console.error("FETCHING", newUrl);
      if (newUrl.length > 0 && count++ < 20000) {
        setTimeout(() => getThis(newUrl), 100);
      } else {
        done = true;
      }
    },
    (err) => {
      console.error(err);
      console.log("It seems there are no more overview pages to fetch.");
    }
  );

getThis();
