import { tickers } from "./tickers.js";

console.log("Anzahl Tickers:", tickers.length);
// deine checks hier...
const range = (start, end) => {
  const arr = [];
  for (let i = start; i <= end; i++) {
    arr.push(i);
  }
  return arr;
};

const sorted = (arr) => {
  const b = arr.map((e) => e);
  b.sort((a, b) => a - b);
  return b;
};

console.log(+tickers[0].num);

const histo = tickers
  .map((t) => t.num)
  .reduce((acc, v) => Object.assign(acc, { [v]: (acc[v] || 0) + 1 }), {});

const maxi = Math.max(
  ...Object.keys(histo)
    .map((e) => +e)
    .filter((e) => e === e),
);

console.log(maxi);

console.log(range(1, maxi).filter((e) => !histo[`${e}`]).join(", "));
