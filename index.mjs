import http from "https";
import regex from "./regex.mjs";
import fs, { readFileSync } from "fs";

const mainPageURL = `https://www.der-postillon.com/search/label/Newsticker`;

const alreadyFetched = JSON.parse(readFileSync("./alreadyFetched.json"));

const fetchAsString = (url, cb, errCallback) => {
  if (url !== mainPageURL) {
    if (alreadyFetched.indexOf(url) >= 0) {
      console.log("Page already fetched", url);
      return;
    }
  }

  http.get(url, (res) => {
    let rawData = "";

    res.on("data", (chunk) => {
      rawData += chunk;
    });

    res.on("end", () => {
      alreadyFetched.push(url);
      cb(rawData);
    });

    res.on("error", errCallback);
  });
};

const reg_who_is_who =
  /<span style="font-size: x-small;"[\n]*>(.*)<[\n]*\/span[\n]*>/gm;

const reg_sub_url =
  /(https:\/\/www.der-postillon.com\/[0-9]+\/[0-9]+\/(news|musk)ticker-[0-9]+[\-a-z0-9A-Z_]*.html)/gm;

//const reg_sub_url =
//  /(https:\/\/www.der-postillon.com\/[0-9]+\/[0-9]+\/newsticker-[0-9]+\.html)/gm;

const reg_sub_url_number =
  /https:\/\/www.der-postillon.com\/[0-9]+\/[0-9]+\/(news|musk)ticker-([0-9]+)[_\-a-z0-9]*.html/gm;

const reg_next_overview_link = /data-load=\'([^\'].*)/gm;

const reg_newsticker = /<p>\+\+\+ (.*) \+\+\+<\/p>/gm;
const reg_newsticker_plain = /\+\+\+ (.*) \+\+\+<br \/>/gm;

const urlsToFetch = [];

let done = false;

const resultingTickers = JSON.parse(
  (fs.readFileSync("./tickers.js") + "").replace("export const tickers =", "")
);

const add = (url, num, content, creatorNames = []) => {
  if (resultingTickers.filter((e) => e.content === content).length === 0)
    resultingTickers.push({ url, num, content, creators: creatorNames });
};

const taggs = /<[^>]*>/gim;
const sanitize = (e = "") => console.log(e) || e.replaceAll(taggs, "");

const countNeedles = (haystack = "", needle) =>
  haystack.split("").filter((e) => e === needle).length;

const timer = setInterval(() => {
  if (urlsToFetch.length > 0) {
    const nextPageURL = urlsToFetch.shift();

    console.error("FETCHING ", nextPageURL);
    let num = 0;
    regex(
      nextPageURL,
      reg_sub_url_number,
      (m) => (num = m[0] === "musk" ? "musk" + m[1] : m[1])
    );

    fetchAsString(
      nextPageURL,
      (pageString) => {
        let creatorNames = "";

        regex(pageString, reg_who_is_who, (creators) => {
          console.error(creators);
          if (countNeedles(creators[0], ",") >= 3) creatorNames = creators[0];
        });
        console.log("CREATOR NAMES", creatorNames);

        creatorNames = sanitize(creatorNames);
        creatorNames = creatorNames.split(",").map((e) => e.trim());

        regex(pageString, reg_newsticker, (newsTicker, idx) =>
          add(
            nextPageURL,
            num,
            newsTicker[0],
            creatorNames[idx] && creatorNames[idx].split("/")
          )
        );
        regex(pageString, reg_newsticker_plain, (newsTicker, idx) =>
          add(
            nextPageURL,
            num,
            newsTicker[0],
            creatorNames[idx] && creatorNames[idx].split("/")
          )
        );
      },
      console.error
    );
  } else {
    if (done) {
      clearInterval(timer);
      fs.writeFileSync(
        "tickers.js",
        "export const tickers = \n" + JSON.stringify(resultingTickers, null, 1)
      );
      fs.writeFileSync(
        "alreadyFetched.json",
        JSON.stringify(alreadyFetched, null, 1)
      );
    }
  }
  console.error("Pages to retrieve", urlsToFetch.length, done);
}, 500);

let count = 0;

const getMainPage = (
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
      if (
        newUrl.length > 0 &&
        count++ < 20000 &&
        alreadyFetched.indexOf(newUrl) < 0
      ) {
        setTimeout(() => getMainPage(newUrl), 200);
      } else {
        done = true;
      }
    },
    (err) => {
      console.error(err);
      console.log("It seems there are no more overview pages to fetch.");
    }
  );

getMainPage();
