'use strict';

let browser = self.browser || self.chrome;

import { AtomFeed, RssFeed } from './feed.js';
import * as store from './store.js';
import { fromIDN } from './punycode.js';

export function findParent(el, selector) {
	while (!el.matches(selector)) {
		if (el === document.body) return null;
		el = el.parentElement;
	}
	return el;
}

export function fixLink(link, feedLink) {
  if (!link.startsWith("http")) {
    let feedUrl = new URL(feedLink);
    return feedUrl.protocol + "//" + feedUrl.host + link;
  }
  return link;
}

async function parseFeed(reader, url) {
  const { value, done } = await reader.read();

  let decoder = new TextDecoder("utf-8");
  let chunk = decoder.decode(value, {stream: true});

  let m = chunk.match(/<\?xml.+encoding="(.+?)".*\?>/);
  if (m && m[1].toLowerCase() != "utf-8") {
    decoder = new TextDecoder(m[1]);
    chunk = decoder.decode(value, {stream: true});
  }

  let num = await store.getOptionInt("fetch-limit") || 10;

  if (chunk.includes("<rss")) {
    var feed = new RssFeed(url, num);
  } else if (chunk.includes("<feed")) {
    var feed = new AtomFeed(url, num);
  } else {
    throw new Error(`invalid feed from ${url}`);
  }

  if (feed.write(chunk)) return feed;

  while (!done) {
    const { value, done } = await reader.read();
    let chunk = decoder.decode(value, {stream: true});
    if (feed.write(chunk)) break;
  };

  return feed;
}

export async function fetchFeed(url, timeout) {
  console.log("fetching", url);
  let manifest = await browser.runtime.getManifest();
  var resp = await fetch(url, {
    credentials: "omit",
    cache: "no-cache",
    headers: {
      "User-Agent": "WebFeed/" + manifest.version,
    },
    signal: AbortSignal.timeout(timeout||10000),
  });
  if (!resp.ok) {
    throw new Error(`fetch ${url} failed, code: ${resp.status}`);
  }
  let reader = resp.body.getReader();

  let feed = await parseFeed(reader, url);
  await reader.cancel();

  return { resp, feed };
}

export async function syncAll() {
  if (!navigator.onLine) { return; }

  if (await store.isFetching()) { return; }

  let now = new Date();
  let last = await store.getLastFetchTime();
  let interval = await store.getOptionInt("fetch-interval") || 60;
  if ((now - last) < interval*60*1000) { return; }

  try {
    await store.setFetching();
    let newEntries = 0;
    let urls = await store.listFeeds();
    let saveDays = await store.getOptionInt("entry-save-days") || 30;
    let cleanDate = new Date(new Date() - saveDays * 86400 * 1000);

    for (const url of urls) {
      try {
        let { resp, feed } = await fetchFeed(url, 10000);
        let entries = feed.entries.filter(f => f.updated >= cleanDate);

        // feed may be unsubscribed during fetch
        if (!await store.subscribed(url)) {
          continue;
        }

        newEntries += await store.saveEntries(feed.url, entries);
      } catch (e) {
        console.error(e);
      }
    }

    if (newEntries > 0) {
      await store.incrUnreadNum(newEntries);
      await store.cleanEntries(cleanDate);
    }

    await store.setLastFetchTime(now);
  } finally {
    await store.unsetFetching();
  }
}

// publisher may embed html code in <pre> or <code>
// this should convert to text recursively.
export async function html2txt(e) {
  for (let i = 0; i < 10; i++) {
    if (e.children) {
      e.innerHTML = e.innerText;
    } else {
      break;
    }
  }
}

export function getSiteTitle(link) {
  let url = new URL(link);
  let title = url.hostname.replace("www.", "")
  if (title === "medium.com") {
    title += url.pathname.replace("/feed", "");
  } else if (title.indexOf("xn--") >= 0) {
    title = fromIDN(title);
  }
  return title;
}
