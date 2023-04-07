import fs from "fs";

const { keys } = Object;

let result = fs.readFileSync("newsticker").toString().split("\n");
result = result.reduce((acc, v) => {
  // console.log(acc, v, acc[v]);
  acc[v] = acc[v] + 1 || 1;
  return acc;
}, {});

console.log(keys(result).join("\n"));
