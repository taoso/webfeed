'use strict';

let browser = self.browser || self.chrome;

import * as utils from './utils.js';
import * as store from './store.js';

async function renderHTML(feed, resp) {
  let header = document.querySelector('body header');

  header.querySelector('h1').innerHTML = feed.title;
  let h1 = header.querySelector('#site-link')
  h1.href = feed.link;
  h1.innerHTML = utils.getSiteTitle(feed.link);

  let img = header.querySelector('#site-icon');
  img.src = await store.getIcon(h1.innerHTML);

  let button = header.querySelector('subscribe-button')
  button.dataset.url = feed.url
  button.dataset.link = feed.link
  button.dataset.title = feed.title

  let bs = await browser.bookmarks.search({url:document.URL});
  if (bs.length > 0) {
    button.innerHTML = "Unsubscribe";
  } else {
    if (resp.redirected) {
      let url = browser.runtime.getURL(`show.html?url=${encodeURI(resp.url)}`);
      document.location.href = url;
      return;
    }
    button.innerHTML = "Subscribe";
  }
  button.style.display = "inline";

  let invalid = false;

  button.onclick = async (e) => {
    if (invalid) {
      alert("invalid feed");
      return;
    }
    if (button.innerHTML == "Subscribe") {
      await store.subscribe(e.target.dataset);
      await store.saveEntries(feed.url, feed.entries);
      button.innerHTML = "Unsubscribe";
    } else {
      let bs = await browser.bookmarks.search({url:document.URL});
      await browser.bookmarks.remove(bs[0].id);
      await store.removeEntries(feed.url);
      button.innerHTML = "Subscribe";
    }
  };

  const template = document.getElementById("feed-item");

  feed.entries.forEach(entry => {
    const content = template.content.cloneNode(true);

    if (isNaN(entry.updated)) {
      invalid = true;
    }

    content.querySelector("article>h2").innerHTML = entry.title;
    content.querySelector("article>time").innerHTML = entry.updated.toLocaleString();

    let sum = content.querySelector("article>div");
    sum.innerHTML = entry.summary;

    utils.html2txt(sum);

    let link = utils.fixLink(entry.link, feed.url);
    content.querySelector("article>a").href = link;

    // drop duplicate read more link in content
    let a = sum.querySelector(`a[href="${link}"]`);
    if (a) a.outerHTML = '';

    content.querySelectorAll("article>div img").forEach(img => {
      if (img.dataset.src) {
        img.src = img.dataset.src;
      }
      img.src = utils.fixLink(img.src, feed.url);
      img.onerror = (e) => {
        img.style.display = 'none';
      };
    });

    content.querySelectorAll("article>div a").forEach(a => {
      a.href = utils.fixLink(a.href, feed.url);
    });

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
  <p style="color:red;">${e}</p>
  <p><pre>${e.stack}</pre></p>
  <p>You may go to the site to find the latest feed and unsubscribe this one.</p>
  <a href="${url}">${url}</a>
</div>
`;
    document.body.appendChild(error);
    return;
  }
}

main().catch(e => console.error(e));
