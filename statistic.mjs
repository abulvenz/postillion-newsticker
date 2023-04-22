const result = tickers.map((e) => e.num);

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

const r = range(1938).filter((n) => deduped.indexOf(n) < 0);

console.log(r);
