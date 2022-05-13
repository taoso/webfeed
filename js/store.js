'use strict';

import * as idb from "./idb.js";

let browser = self.browser || self.chrome;

export async function subscribed(url) {
  url = browser.runtime.getURL(`show.html?url=${encodeURI(url)}`);
  let bs = await browser.bookmarks.search({url});
  return bs.length > 0;
}

export async function subscribe(data) {
  let bs = await browser.bookmarks.search({title:"[web-feed]"});
  if (bs.length > 0) {
    var id = bs[0].id;
  } else {
    let b = await browser.bookmarks.create({title:"[web-feed]"});
    var id = b.id
  }

  let url = browser.runtime.getURL(`show.html?url=${encodeURI(data.url)}`);

  bs = await browser.bookmarks.search({url:url});
  let title = `${data.title}[${data.link}]`;
  if (bs.length > 0) {
    await browser.bookmarks.update(bs[0].id, {
      title: title,
    });
  } else {
    await browser.bookmarks.create({
      parentId: id,
      url: url,
      title: title,
    });
  }
}

export async function fixBookmarks() {
  let bs = await browser.bookmarks.search({title:"[web-feed]"});
  if (bs.length === 0) return;

  let host = await browser.runtime.getURL("").split("/")[2];
  let feeds = await browser.bookmarks.getChildren(bs[0].id);
  let exists = {};
  for (let feed of feeds) {
    let url = new URL(feed.url);

    let feedUrl = url.searchParams.get("url");
    if (exists[feedUrl]) {
      console.debug(`removing duplicated ${feedUrl}`);
      await browser.bookmarks.remove(feed.id);
      continue;
    }
    exists[feedUrl] = true;

    url.host = host;
    let newUrl = url.toString();
    await browser.bookmarks.update(feed.id, {url: newUrl});
    console.debug(`convert ${feed.url} to ${newUrl}`);
  }
}

export async function openDB() {
  let db = await idb.openDB("web-feed", 1, {
    upgrade(db) {
      const store = db.createObjectStore('entries', {
        keyPath: "id",
        autoIncrement: true,
      });
      store.createIndex('idx', 'idx');
      store.createIndex('link', 'link', { unique: true });
      store.createIndex('site', 'site');
    },
  });
  return db;
}

export async function saveEntries(url, entries) {
  let db = await openDB();

  let maxTime = (new Date("9999-01-01")).getTime();
  for (const entry of entries) {
    entry.idx = maxTime - entry.updated.getTime();
    entry.site = url;
    try {
      const value = await db.getFromIndex('entries', 'link', entry.link);
      if (!value) {
        await db.add('entries', entry);
      }
    } catch (e) {
      console.error(e);
    }
  }
}

export async function cleanEntries(limit) {
  let db = await openDB();
  let tx = db.transaction("entries", 'readwrite');
  let index = tx.store.index("idx");
  let begin = IDBKeyRange.lowerBound(0);
  for await (const cursor of index.iterate(begin)) {
    if (--limit < 0) {
      await cursor.delete();
    }
  }
}

export async function removeEntries(url) {
  let db = await openDB();

  let tx = db.transaction("entries");
  const index = tx.store.index("site");
  const site = IDBKeyRange.only(url);

  let ids = [];
  for await (const cursor of index.iterate(site)) {
    ids.push(cursor.value.id);
  }

  for (const id of ids) {
    await db.delete("entries", id);
  }
}

export async function listFeeds() {
  let bs = await browser.bookmarks.search({title:"[web-feed]"});
  if (bs.length == 0)  return [];

  let feeds = await browser.bookmarks.getChildren(bs[0].id);
  return feeds.map(f => {
    let i = f.url.indexOf("show.html?url=")+14;
    return f.url.substring(i);
  });
}

export async function getLastFetchTime(url) {
  let key = "last-fetch:"+url;
  let result = await browser.storage.sync.get(key) || {};

  let s = result[key];
  if (s) {
    return new Date(s);
  }

  return new Date("2000-01-01");
}

export async function setLastFetchTime(url, time) {
  let objects = {};
  let key = "last-fetch:"+url;
  objects[key] = time.toString();

  await browser.storage.sync.set(objects);
}

export async function setLastId(id) {
  await browser.storage.sync.set({"last-id": id});
}

export async function getLastId() {
  let results = await browser.storage.sync.get("last-id") || {};
  let id = results["last-id"]
  if (id) {
    return parseInt(id);
  }

  return Number.MAX_SAFE_INTEGER;
}

export async function setOption(name, value) {
  let opts = {};
  opts["option-"+name] = value;
  await browser.storage.sync.set(opts);
}

export async function getOptionInt(name) {
  let key = "option-"+name;
  let results = await browser.storage.sync.get(key) || {};
  let value = results[key]
  if (value) {
    return parseInt(value);
  }
}
