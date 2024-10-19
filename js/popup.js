'use strict';

let browser = self.browser || self.chrome;

import { findParent } from './utils.js';

const feeds = JSON.parse(
  decodeURIComponent(window.location.search.substr(7))
);

const types = {
  "application/rss+xml": "rss",
  "application/atom+xml": "atom",
  "html": "html",
  "link": "link",
};

document.addEventListener("click", e => {
  const el = findParent(e.target, ".items__item-link");
  if (!el) return;
  e.preventDefault();

  let creating = browser.tabs.create({
    url: el.dataset.url
  });
  window.close();
});

feeds.unshift({
  title: "My Feeds",
  url: browser.runtime.getURL(`list.html`),
  type: "html",
});

const template = document.getElementById("item");
const items = feeds.map(feed => {
  const content = template.content.cloneNode(true);
  const link = content.querySelector(".items__item-link");
  const extURL = browser.runtime.getURL(`show.html?url=${encodeURI(feed.url)}`);
  link.href = feed.url;

  if (feed.type === "html") {
    link.dataset.url = feed.url;
  } else {
    link.dataset.url = extURL;
  }

  link.innerHTML =
    (feed.title || feed.url) +
      (types[feed.type]
        ? ` <span style="opacity:0.6;">(${types[feed.type]})</span>`
        : "");
  return content;
});

const fragment = document.createDocumentFragment();
items.forEach(el => fragment.appendChild(el));

document.querySelector(".items").appendChild(fragment);
