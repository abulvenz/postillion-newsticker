import http from "https";

const { keys } = Object;

const range = (N) => {
  const r = [];
  for (let i = 0; i < N; i++) r.push(i);
  return r;
};

const requestsToPerform = range(1000).map((e) => e + 1);

const performRequest = (N) => {
  console.error("Running request: " + N);

  requestsToPerform.splice(requestsToPerform.indexOf(N), 1);
  const idx = N;
  const url = `https://www.blogger.com/feeds/746298260979647434/posts/default/-/Newsticker?max-results=3&start-index=${idx}&alt=json-in-script&callback=ABC&_=1680637997238`;
  // `https://www.der-postillon.com/search/label/Newsticker?max-results=20&start=${idx}&by-date=false`;
  http.get(url, (res) => {
    let rawData = "";

    res.on("data", (chunk) => {
      rawData += chunk;
    });

    res.on("end", () => {
      const parsedData = rawData
        .replace("// API callback", "")
        .replace("ABC(", "")
        .slice(0, rawData.length - 21);

      const str = JSON.parse(parsedData).feed.entry[0].content.$t;

      const regex = /<p>\+\+\+ (.*) \+\+\+<\/p>/g;

      let m;

      while ((m = regex.exec(str)) !== null) {
        // This is necessary to avoid infinite loops with zero-width matches
        if (m.index === regex.lastIndex) {
          regex.lastIndex++;
        }
        console.log(m[1]);
      }

      if (requestsToPerform.length > 1) {
        nextTimeOut = setTimeout(
          () => performRequest(requestsToPerform[0]),
          10
        );
      } else nextTimeOut = null;
    });
  });
};

let nextTimeOut = setTimeout(() => performRequest(requestsToPerform[0]), 0);

/*while (nextTimeOut !== null) {
  console.error("Wait");
}*/
