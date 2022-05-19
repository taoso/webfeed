'use strict';

let browser = self.browser || self.chrome;
browser.action = browser.action || browser.browserAction;

import { AtomFeed, RssFeed } from './feed.js';
import * as store from './store.js';

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
  } else {
    var feed = new AtomFeed(url, num);
  }

  if (feed.write(chunk)) return feed;

  while (!done) {
    const { value, done } = await reader.read();
    let chunk = decoder.decode(value, {stream: true});
    if (feed.write(chunk)) break;
  };

  return feed;
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

  let feed = await parseFeed(reader, url);
  await reader.cancel();

  return { resp, feed };
}

export async function syncAll() {
  if (!navigator.onLine) return;

  let now = new Date();
  let last = await store.getLastFetchTime();
  let interval = await store.getOptionInt("fetch-interval") || 60;
  if ((now - last) < interval*60*1000) return;

  let newEntries = 0;
  let urls = await store.listFeeds();
  let saveDays = await store.getOptionInt("entry-save-days") || 30;
  let cleanDate = new Date(new Date() - saveDays * 86400 * 1000);

  for (const url of urls) {
    try {
      let { resp, feed } = await fetchFeed(url);
      let entries = feed.entries.filter(f => f.updated >= cleanDate);
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
