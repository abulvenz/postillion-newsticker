import http from "https";
import regex from "./regex.mjs";

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

const regy =
  /(https:\/\/www.der-postillon.com\/[0-9]+\/[0-9]+\/newsticker-[0-9]+\.html)/gm;

const regy2 =
  /https:\/\/www.der-postillon.com\/[0-9]+\/[0-9]+\/newsticker-([0-9]+).html/gm;

const regexp = /data-load=\'([^\'].*)/gm;

const reg_newsletter = /<p>\+\+\+ (.*) \+\+\+<\/p>/gm;
const reg_newsletter2 = /\+\+\+ (.*) \+\+\+<br \/>/gm;

// Alternative syntax using RegExp constructor
// const regex = new RegExp('href="(https:\\/\\/www.der-postillon.com\\/[0-9]+\\/[0-9]+\\/newsticker-[0-9]+.html)', 'gm')

const urlsToFetch = [];

const timer = setInterval(() => {
  if (urlsToFetch.length > 0) {
    const nextPageURL = urlsToFetch.shift();

    console.error("FETCHING ", nextPageURL);
    let num = 0;
    regex(nextPageURL, regy2, (m) => (num = m[0]));

    fetchAsString(
      nextPageURL,
      (pageString) => {
        regex(pageString, reg_newsletter, (newsTicker) =>
          console.log(nextPageURL, num, newsTicker[0])
        );
        regex(pageString, reg_newsletter2, (newsTicker) =>
          console.log(nextPageURL, num, newsTicker[0])
        );
      },
      console.error
    );
  }
  console.error("Pages to retrieve", urlsToFetch.length);
}, 500);

const getThis = (
  url = `https://www.der-postillon.com/search/label/Newsticker`
) =>
  fetchAsString(
    url,
    (res) => {
      let newUrl = "";
      console.error("Running regex");
      regex(res, regy, (m) => {
        if (urlsToFetch.indexOf(m[0]) < 0) urlsToFetch.push(m[0]);
      });
      regex(res, regexp, (m) => (newUrl = m[0]));
      // console.log(res);
      console.error("Found so far", urlsToFetch.length, " URLS");
      console.error("FETCHING", newUrl);
      if (newUrl.length > 0) setTimeout(() => getThis(newUrl), 100);
    },
    (err) => {
      console.error(err);
      console.log("It seems there are no more overview pages to fetch.");
    }
  );

getThis();
