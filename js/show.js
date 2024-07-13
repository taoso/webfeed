'use strict';

let browser = self.browser || self.chrome;

import * as utils from './utils.js';
import * as store from './store.js';

async function renderHTML(feed) {
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
      button.innerHTML = "Unsubscribe";
      await utils.fetchFeed(feed.url, async (resp, feed) => {
        await store.saveEntries(feed.url, feed.entries);
      });
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
    content.querySelector("article>div").innerHTML = entry.summary;
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

    utils.dropHr(content);

    document.querySelector(".items").appendChild(content);
  });
}

async function main() {
  let url = decodeURI(window.location.search.substr(5));
  if (url.indexOf("ext%2Brss%3A") === 0) {
    url = decodeURIComponent(url.substr(12));
    window.location.replace("/show.html?url=" + encodeURI(url));
  }

  try {
    let { resp, feed } = await utils.fetchFeed(url);
    if (resp.status >= 400) {
      const notFound = document.createElement("div");
      notFound.innerHTML = `
        <div>
          <h1>404</h1>
          <p>Feed <a href="${url}">${url}</a> not found</p>
        </div>
      `;
      document.body.appendChild(notFound);
      return;
    }
    await renderHTML(feed);
  } catch (e) {
    console.error(e);
    const error = document.createElement("div");
    error.innerHTML = `
        <div>
          <h1>Error</h1>
          <p>Error while fetching feed</p>
          <p style="color:red;">${e}</p>
          <a href="${url}">${url}</a>
        </div>
      `;
    document.body.appendChild(error);
    return;
  }
}

main().catch(e => console.error(e));
