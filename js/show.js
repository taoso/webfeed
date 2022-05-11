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

  button.onclick = async (e) => {
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
    await utils.setBadge();
  };

  const template = document.getElementById("feed-item");

  if (self.browser) {
    let rewriteRefer = (e) => {
      e.requestHeaders.push({name:"Referer", value:feed.url})
      return {requestHeaders: e.requestHeaders};
    }

    browser.webRequest.onBeforeSendHeaders.addListener(
      rewriteRefer,
      {urls: ["*://*/*"]},
      ["blocking", "requestHeaders"]
    );
  }

  feed.entries.forEach(entry => {
    const content = template.content.cloneNode(true);

    content.querySelector("article>h2").innerHTML = entry.title;
    content.querySelector("article>time").innerHTML = entry.updated.toLocaleString();
    content.querySelector("article>div").innerHTML = entry.summary;
    content.querySelector("article>a").href = utils.fixLink(entry.link, feed.url);

    content.querySelectorAll("article>div img").forEach(img => {
      if (img.dataset.src) {
        img.src = img.dataset.src;
      }
      img.src = utils.fixLink(img.src, feed.url);
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
    await utils.fetchFeed(url, async (resp, feed) => {
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
    })
  } catch (e) {
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
