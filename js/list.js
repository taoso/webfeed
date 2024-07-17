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

    $("article>h2").innerHTML = entry.title;
    $("article>.meta time").innerHTML = entry.updated.toLocaleString();
    $("article>.meta a.link").href = entry.link;

    let sum = $("article>div");
    sum.innerHTML = entry.summary;

    // drop duplicate read more link in content
    let a = $(`article>.summary a[href="${entry.link}"]`);
    if (a) a.outerHTML = '';

    utils.html2txt(sum);

    let showUrl = browser.runtime.getURL(`show.html?url=${encodeURI(entry.site)}`)
    let site = utils.getSiteTitle(entry.site);
    $("article>.meta a.site").href = showUrl;
    $("article>.meta a.site").innerHTML = site;
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
    more.innerHTML = "There is no more";
  }
}

async function main() {
  lastId = await store.getLastId();

  await store.resetUnreadNum();

  let log = await store.getFetchLog();
  if (log.count > 0) {
    let alert = document.querySelector("#alert");
    alert.style.display = 'flex';
    alert.onclick = async (e) => {
      if (e.target.dataset.cmd === "dismiss") {
        alert.style.display = 'none';
        await store.setFetchLog({});
      }
    };
  }

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
        await listEntries(last);
      } while (!full);
    }
  });
  observer.observe(more);
}

main().catch(e => console.error(e));
