'use strict';

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
    await browser.browserAction.setBadgeText({text:num.toString()});
  } else {
    await browser.browserAction.setBadgeText({text:""});
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

  const utf8Decoder = new TextDecoder("utf-8");

  let chunk = utf8Decoder.decode(value, {stream: true});

  let parser = new Parser();
  let num = 10;

  if (chunk.includes("<rss")) {
    var feed = new RssFeed(parser, finished, num);
  } else {
    var feed = new AtomFeed(parser, finished, num);
  }

  feed.url = url;

  parser._write(chunk);

  while (!done) {
    const { value, done } = await reader.read();
    if (done) break;
    let chunk = utf8Decoder.decode(value, {stream: true});
    parser._write(chunk);
  };
}

export async function fetchFeed(url, done) {
  console.log("fetching", url);
  var resp = await fetch(url);
  let reader = resp.body.getReader();
  await parse(reader, url, async (feed) => {
    reader.cancel();
    done(resp, feed);
  });
}

export async function syncAll() {
  let urls = await store.listFeeds();
  for (const url of urls) {
    let now = new Date();
    let last = await store.getLastFetchTime(url);
    if ((now - last) < 60*60*1000) {
      console.log("skip, last fetched at: ", last);
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
