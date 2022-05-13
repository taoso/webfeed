'use strict';

let browser = self.browser || self.chrome;
browser.action = browser.action || browser.browserAction;

import Parser from './parser.js';
import { AtomFeed, RssFeed } from './feed.js';
import * as store from './store.js';

export function findParent(el, selector) {
	while (!el.matches(selector)) {
		if (el === document.body) return null;
		el = el.parentElement;
	}
	return el;
}

export async function setBadge() {
  let last = await store.getLastId();

  let db = await store.openDB();
  let tx = db.transaction("entries");
  const index = tx.store.index("idx");
  const begin = IDBKeyRange.upperBound(last, true);

  let num = 0;
  for await (const cursor of index.iterate(begin)) {
    num++;
  }

  if (num > 0) {
    await browser.action.setBadgeText({text:num.toString()});
  } else {
    await browser.action.setBadgeText({text:""});
  }
}

export function fixLink(link, feedLink) {
  if (!link.startsWith("http")) {
    let feedUrl = new URL(feedLink);
    return feedUrl.protocol + "//" + feedUrl.host + link;
  }
  return link;
}

async function parse(reader, url, finished) {
  const { value, done } = await reader.read();

  let decoder = new TextDecoder("utf-8");
  let chunk = decoder.decode(value, {stream: true});

  let m = chunk.match(/<\?xml.+encoding="(.+?)".*\?>/);
  if (m && m[1].toLowerCase() != "utf-8") {
    decoder = new TextDecoder(m[1]);
    chunk = decoder.decode(value, {stream: true});
  }

  let parser = new Parser();
  let num = await store.getOptionInt("fetch-limit") || 10;

  if (chunk.includes("<rss")) {
    var feed = new RssFeed(url, finished, num);
  } else {
    var feed = new AtomFeed(url, finished, num);
  }

  parser.emit = feed.emitAll.bind(feed);

  parser._write(chunk);

  while (!done) {
    const { value, done } = await reader.read();
    if (done) return;
    let chunk = decoder.decode(value, {stream: true});
    parser._write(chunk);
  };
}

export async function fetchFeed(url, done) {
  console.log("fetching", url);
  let manifest = await browser.runtime.getManifest();
  var resp = await fetch(url, {
    cache: "no-cache",
    headers: {
      "user-agent": navigator.userAgent + " WebFeed/" + manifest.version,
    },
  });
  let reader = resp.body.getReader();

  await parse(reader, url, async (feed) => {
    await reader.cancel();
    await done(resp, feed);
  });
}

export async function syncAll() {
  if (!navigator.onLine) return;

  let urls = await store.listFeeds();
  let interval = await store.getOptionInt("fetch-interval") || 60;
  for (const url of urls) {
    let now = new Date();
    let last = await store.getLastFetchTime(url);
    if ((now - last) < interval*60*1000) {
      continue;
    }

    try {
      await fetchFeed(url, async (resp, feed) => {
        await store.saveEntries(feed.url, feed.entries);
      });
      await store.setLastFetchTime(url, now);
    } catch (e) {
      console.error(e);
    }
  }
  await setBadge();
}

export async function dropHr(content) {
  let nodes = content.querySelectorAll("hr,hr~*");

  if (nodes.length === 0) return;

  let prev = nodes[0].previousElementSibling;
  if (prev) prev.style.marginBottom = "0px";

  nodes.forEach(n => n.remove());
}

export function getSiteTitle(link) {
  let url = new URL(link);
  let title = url.hostname.replace("www.", "")
  if (title === "medium.com") {
    title += url.pathname.replace("/feed", "");
  }
  return title;
}
