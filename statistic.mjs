import fs from "fs";

const tickers = JSON.parse(
  (fs.readFileSync("./tickers.js") + "").replace("export const tickers =", "")
);

const result = tickers.map((e) => e.num);

const creators = [];
const names = tickers.map((e) => {
  if (e.creators !== "") {
    e.creators.forEach((c) => {
      if (creators.indexOf(c) < 0) {
        creators.push(c);
      }
    });
  } else {
    console.log(e.num);
  }
});

const range = (N) => {
  const r = [];
  for (let index = 0; index < N; index++) {
    r.push(index);
  }
  return r;
};

let deduped = Object.keys(
  result.reduce((acc, v) => {
    acc[v] = acc[v] + 1 || 1;
    return acc;
  }, {})
);

deduped = deduped.map((e) => +e).sort((a, b) => a - b);

const r = range(1942)
  .map((e) => e + 1)
  .filter((n) => deduped.indexOf(n) < 0);

console.log(r);

// console.log(JSON.stringify(creators,null,2));
