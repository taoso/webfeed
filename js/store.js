'use strict';

import * as idb from "./idb.js";

let browser = self.browser || self.chrome;

export async function saveIcon(domain, icon) {
  let opts = {};
  opts["icon-"+domain] = icon;
  await browser.storage.local.set(opts);
}

export async function getIcon(domain) {
  let key = "icon-"+domain;
  let results = await browser.storage.local.get(key) || {};

  return results[key] || 'icons/icon-square.png';
}

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

    let newUrl = await browser.runtime.getURL(`show.html?url=${encodeURI(feedUrl)}`);
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

const maxTime = (new Date("9999-01-01")).getTime();

export async function saveEntries(url, entries) {
  let db = await openDB();

  let added = 0;
  for (const entry of entries) {
    entry.idx = maxTime - entry.updated.getTime();
    entry.site = url;
    try {
      const value = await db.getFromIndex('entries', 'link', entry.link);
      if (!value) {
        await db.add('entries', entry);
        added++;
      }
    } catch (e) {
      console.error(e);
    }
  }
  return added;
}

export async function cleanEntries(cleanDate) {
  let db = await openDB();
  let tx = db.transaction("entries", 'readwrite');
  let index = tx.store.index("idx");

  let idx = maxTime - cleanDate.getTime();
  let begin = IDBKeyRange.lowerBound(idx);
  for await (const cursor of index.iterate(begin)) {
    cursor.delete();
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

export async function getLastFetchTime() {
  let key = "last-fetch-at";
  let result = await browser.storage.sync.get(key) || {};

  let s = result[key];
  if (s) {
    return new Date(s);
  }

  return new Date("2000-01-01");
}

export async function setLastFetchTime(time) {
  let objects = {};
  let key = "last-fetch-at";
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

  return 0;
}

export async function resetUnreadNum() {
  await browser.storage.sync.set({"unread-num": 0});
  await browser.action.setBadgeText({text:""});
}

export async function incrUnreadNum(num) {
  num += await getUnreadNum();
  await browser.storage.sync.set({"unread-num": num});
  await browser.action.setBadgeText({text: num.toString()});
}

async function getUnreadNum() {
  let results = await browser.storage.sync.get("unread-num") || {};
  let num = results["unread-num"]
  if (num) {
    return parseInt(num);
  }

  return 0;
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

export async function setFetching() {
  let n = new Date;
  let opts = {};
  opts["fetching@"+n.getHours()] = "1";
  await browser.storage.local.set(opts);
}

export async function unsetFetching() {
  let n = new Date;
  let key = "fetching@"+n.getHours();
  await browser.storage.local.remove(key);
}

export async function isFetching() {
  let n = new Date;
  let key = "fetching@"+n.getHours();
  let results = await browser.storage.local.get(key) || {};
  return results[key] === "1";
}
