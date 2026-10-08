# postillion-newsticker
Extraction of very important lines of poetry.

A live version of the cached newstickers can be found [here](https://abulvenz.github.io/postillion-newsticker/).

## How does it work?

The content of the page https://der-postillon.com/ is parsed by a node script index.mjs. 
This will load and alter two files: 
- `alreadyFetched.json` containing the URLs of all pages that have already been downloaded.
- `tickers.js` containing all tickers including their source URLs, authors and the number of the ticker page.

Once those files have been written, [parceljs](https://parceljs.org/) is used to package a small web application with entry point `index.html` that uses the following technologies:
- [minicss](https://minicss.us) for the layout
- [mithril.js](https://mithril.js.org) as frontend framework
- [tagl-mithril](https://www.npmjs.com/package/tagl-mithril) to easier write mithril HTML in Javascript
- [fuse.js](https://fusejs.io/) for more fuzzy search options

The entire process is automated in a github action which runs on Monday, Wednesday and Friday at 08:45 UTC (shortly after the new ticker appears at 09:30 Berlin time). On the 1st of every month a full update re-crawls all tickers. It will run `npm build` and commit the created files, after that the github page is redeployed.

For a full update locally use `node index.mjs --full`.

There are some misunderstandings in my way of using the actions, but it works, so I do not change it at the moment.

## Working locally
First you need to install all dependencies using `npm install`.

Then for fetching the pages use `node index.mjs`.

To start a local development frontent run `ǹpm start`.

Visit the [local frontend](http://localhost:1234)
