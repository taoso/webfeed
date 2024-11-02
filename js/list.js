'use strict';

let browser = self.browser || self.chrome;

import * as utils from './utils.js';
import * as store from './store.js';

let lastId = 0;

async function listEntries(last = 0) {
  let db = await store.openDB();

  const template = document.getElementById("feed-item");
  let tx = db.transaction("entries");
  const index = tx.store.index("idx");

  let num = 5;
  let firstId = 0;
  const begin = IDBKeyRange.lowerBound(last);
  const items = document.querySelector(".items");
  for await (const cursor of index.iterate(begin)) {
    let entry = cursor.value;
    let id = "idb-" + entry.id;

    if (document.getElementById(id)) {
      continue;
    }

    const content = template.content.cloneNode(true);
    let $ = content.querySelector.bind(content);

    $("article>h2").innerText = utils.html2txt(entry.title);
    $("article>.meta time").innerText = entry.updated.toLocaleString();
    $("article>div").innerText = utils.html2txt(entry.summary);
    $("article>.meta a.link").href = entry.link;

    let showUrl = browser.runtime.getURL(`show.html?url=${encodeURI(entry.site)}`)
    let site = utils.getSiteTitle(entry.site);
    $("article>.meta a.site").href = showUrl;
    $("article>.meta a.site").innerText = site;
    let $img = $("article>.meta img.icon");
    store.getIcon(site).then(src => $img.src = src);

    $("article").id = id;

    items.appendChild(content);

    if (lastId === entry.id && items.children.length > 1) {
      let last = items.children[items.children.length-2];
      last.style.borderBottomStyle = "solid";
    }

    if (items.children.length === 1) {
      firstId = entry.id;
    }

    if (--num === 0) {
      document.querySelector("#more").dataset.last = entry.idx;
      break;
    }
  }

  if (firstId > 0) {
    await store.setLastId(firstId);
  }

  let more = document.querySelector("#more")
  if (num > 0) {
    more.dataset.done = true;
    more.innerText = "There is no more feeds to load.";
  }

  return firstId;
}

async function main() {
  lastId = await store.getLastId();

  await store.resetUnreadNum();

  let more = document.querySelector('#more');
  more.onclick = async (e) => {
    if (e.target.dataset.done) return;

    let last = parseInt(more.dataset.last);
    await listEntries(last);
  };
  let full = false;
  let observer = new IntersectionObserver(async (changes) => {
    if (changes[0].intersectionRatio <= 0) {
      full = true;
    }
    if (changes[0].intersectionRatio > 0) {
      let more = changes[0].target;
      if (more.dataset.done) return;

      full = false;

      let last = parseInt(more.dataset.last);
      do {
        if (!await listEntries(last)) {
          full = true;
        }
      } while (!full);
    }
  });
  observer.observe(more);
}

main().catch(e => console.error(e));
