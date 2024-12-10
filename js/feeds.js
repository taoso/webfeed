'use strict';

let browser = self.browser || self.chrome;

import * as store from './store.js';
import * as utils from './utils.js';

async function main() {
  const items = document.querySelector("ol.items");
  let feeds = await store.listFeeds();
  for (const feed of feeds) {
    let li = document.createElement('li');
    let m = /.*\[(.+)]/.exec(feed.title);
    let site = utils.getSiteTitle(m[1]||"");
    let img = await store.getIcon(site);

    li.innerHTML = `<span><img src=""><a target="_blank" href=""></a></span>`;
    li.querySelector('img').src = img;
    let a = li.querySelector('a');
    a.href= `show.html?url=${feed.url}`;
    a.innerText = feed.title;

    items.appendChild(li);
  }
}

main().catch(e => console.error(e));
