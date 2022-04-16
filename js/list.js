'use strict';

import { fixLink, setBadge } from './utils.js';
import { openDB, setLastId, getLastId } from './store.js';

var imgReferers = {};
var firstId = 0;

async function listEntries(last = 0) {
  let db = await openDB();

  const template = document.getElementById("feed-item");
  let tx = db.transaction("entries");
  const index = tx.store.index("idx");

  let num = 5;
  const begin = IDBKeyRange.lowerBound(last);
  const items = document.querySelector(".items");
  for await (const cursor of index.iterate(begin)) {
    if (document.getElementById("idb-"+cursor.key)) {
      continue;
    }

    let entry = cursor.value;

    if (last === 0 && firstId === 0) {
      firstId = cursor.key;
    }

    const content = template.content.cloneNode(true);
    let $ = content.querySelector.bind(content);

    $("article>h2").innerHTML = entry.title;
    $("article>time").innerHTML = entry.updated.toLocaleString();
    $("article>div").innerHTML = entry.summary;
    $("article>a.link").href = entry.link;

    let site = new URL(entry.site);
    let showUrl = browser.runtime.getURL(`show.html?url=${encodeURI(entry.site)}`)
    $("article>a.site").href = showUrl;
    $("article>a.site").innerHTML = site.hostname.replace("www.", "");

    $("article").id = "idb-" + cursor.key;

    let imgs = content.querySelectorAll("img");
    imgs.forEach(img => imgReferers[img.src] = entry.link);

    items.appendChild(content);
    if (--num === 0) {
      document.querySelector("#more").dataset.last = entry.idx;
      break;
    }
  }

  let lastId = await getLastId();
  if (firstId > 0) {
    await setLastId(firstId);
    await setBadge();
  }

  if (lastId > 0) {
    let lastItem = document.getElementById("idb-"+lastId);
    if (lastItem.previousElementSibling) {
      lastItem.previousElementSibling.style.borderBottomStyle = "solid";
    }
  }

  let more = document.querySelector("#more")
  if (num > 0) {
    more.dataset.done = true;
    more.innerHTML = "There is no more";
  }
}

async function main() {
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

  let rewriteRefer = (e) => {
    let referer = imgReferers[e.url];
    if (!referer) return;
    e.requestHeaders.push({name:"Referer", value:referer})
    return {requestHeaders: e.requestHeaders};
  }

  browser.webRequest.onBeforeSendHeaders.addListener(
    rewriteRefer,
    {urls: ["*://*/*"]},
    ["blocking", "requestHeaders"]
  );
}

main().catch(e => console.error(e));