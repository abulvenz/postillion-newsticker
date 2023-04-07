export default function (str, regex, cb) {
  let m;

  console.error("In regex");
  while ((m = regex.exec(str)) !== null) {
    console.error("In while");
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

    console.error("FOUND: ", results);

    cb(results);
  }
}
