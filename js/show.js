'use strict';

let browser = self.browser || self.chrome;

import * as utils from './utils.js';
import * as store from './store.js';

async function renderHTML(feed, resp) {
  let header = document.querySelector('body header');

  header.querySelector('h1').innerText = utils.html2txt(feed.title);
  let h1 = header.querySelector('#site-link')
  h1.href = feed.link;
  h1.innerText = utils.getSiteTitle(feed.link);

  let img = header.querySelector('#site-icon');
  img.src = await store.getIcon(h1.innerText);

  let button = header.querySelector('subscribe-button')
  button.dataset.url = feed.url
  button.dataset.link = feed.link
  button.dataset.title = feed.title

  let bs = await browser.bookmarks.search({url:document.URL});
  if (bs.length > 0) {
    button.innerText = "Unsubscribe";
  } else {
    if (resp.redirected) {
      let url = browser.runtime.getURL(`show.html?url=${encodeURI(resp.url)}`);
      document.location.href = url;
      return;
    }
    button.innerText = "Subscribe";
  }
  button.style.display = "inline";

  let invalid = false;

  button.onclick = async (e) => {
    if (invalid) {
      alert("invalid feed");
      return;
    }
    if (button.innerText == "Subscribe") {
      await store.subscribe(e.target.dataset);
      await store.saveEntries(feed.url, feed.entries);
      button.innerText = "Unsubscribe";
    } else {
      let bs = await browser.bookmarks.search({url:document.URL});
      await browser.bookmarks.remove(bs[0].id);
      await store.removeEntries(feed.url);
      button.innerText = "Subscribe";
    }
  };

  const template = document.getElementById("feed-item");

  feed.entries.forEach(entry => {
    const content = template.content.cloneNode(true);
    let $ = content.querySelector.bind(content);

    if (isNaN(entry.updated)) {
      invalid = true;
    }

    $("article>h2").innerText = utils.html2txt(entry.title);
    $("article>time").innerText = entry.updated.toLocaleString();
    $("article>div").innerText = utils.html2txt(entry.summary);
    $("article>a").href = utils.fixLink(entry.link, feed.url);

    document.querySelector(".items").appendChild(content);
  });
}

async function main() {
  let url = decodeURI(window.location.search.substr(5));

  try {
    let timeout = await store.getOptionInt("fetch-timeout") || 15;
    let { resp, feed } = await utils.fetchFeed(url, timeout, true);
    await renderHTML(feed, resp);
  } catch (e) {
    let bs = await browser.bookmarks.search({url:document.URL});
    if (bs.length > 0) {
      let b = bs[0];
      let g = /(?<title>.+)\[(?<link>.+)\]/.exec(b.title).groups;
      let feed = {
        url: url,
        title: g["title"],
        link: g["link"],
        entries: [],
      };
      await renderHTML(feed, {});
    }

    const error = document.createElement("div");
    error.innerHTML = `
<div>
  <p>Error while fetching feed</p>
  <p class="error" style="color:red;"></p>
  <p><pre></pre></p>
  <p>You may go to the site to find the latest feed and unsubscribe this one.</p>
  <a href="#"></a>
</div>
`;
    let $ = error.querySelector.bind(error);
    $('p.error').innerText = e.message;
    $('pre').innerText = e.stack;
    $('a').href = url;
    $('a').innerText = url;

    document.body.appendChild(error);
    return;
  }
}

main().catch(e => console.error(e));
