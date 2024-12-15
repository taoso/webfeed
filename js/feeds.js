'use strict';

let browser = self.browser || self.chrome;

import * as store from './store.js';
import * as utils from './utils.js';
import * as htmlentity from './htmlentity.js';

async function main() {
  document.getElementById('export').addEventListener('click', async (e) => {
    let ompl = [
      `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
  <head>
    <title>My Subscriptions in WebFeed</title>
  </head>
  <body>`
    ];

    let feeds = await store.listFeeds();
    for (const f of feeds) {
      let t = htmlentity.escape(f.title);
      ompl.push(`<outline text="${t}" type="rss" xmlUrl="${f.url}" htmlUrl="${f.htmlUrl}"/>`)
    }

    ompl.push(`</body>\n</opml>`);

    const blob = new Blob([ompl.join('\n')], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'webfeed-ompl.xml';

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  document.getElementById('import').addEventListener('click', async (e) => {
    document.getElementById('import-file').click();
  });

  document.getElementById('import-file').addEventListener('change', async (e) => {
    let file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dom = new DOMParser().parseFromString(e.target.result, 'text/xml');

      const outline = dom.getElementsByTagName('outline')
      for (const o of outline) {
        if (!/rss/.test(o.getAttribute('type'))) {
          continue
        }
        await store.subscribe({
          url: o.getAttribute('xmlUrl'),
          link: o.getAttribute('htmlUrl'),
          title: o.getAttribute('text'),
        });
      }
      location.reload();
      utils.syncAll();
    };

    reader.onerror = (e) => {
      alert("Error reading file: " + e.target.error.message);
    };

    reader.readAsText(file);
  });

  const items = document.querySelector("ol.items");
  let feeds = await store.listFeeds();
  for (const feed of feeds) {
    let li = document.createElement('li');
    let site = utils.getSiteTitle(feed.htmlUrl);
    let img = await store.getIcon(site);

    li.innerHTML = `<span><img src=""><a href=""></a></span>`;
    li.querySelector('img').src = img;
    let a = li.querySelector('a');
    a.href= `show.html?url=${feed.url}`;
    a.innerText = site+' ['+feed.title+']';

    items.appendChild(li);
  }
}

main()
