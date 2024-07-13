'use strict';

import * as utils from "./js/utils.js";
import * as store from "./js/store.js";

let browser = self.browser || self.chrome;

const handler = async (id) => {
  let tab = await browser.tabs.get(id);

  let feeds = [];

  if (tab.url && tab.url.startsWith("http")) {
    let x = await browser.scripting.executeScript({
      target: {tabId: id},
      files: ['./js/page.js'],
    });

    feeds = x[0].result || [];
  }

  let popup = "";
  if (feeds.length > 0) {
    await browser.action.setIcon({
      path: "icons/icon-square.png",
      tabId: id
    });

    popup = `./popup.html?links=${encodeURIComponent(JSON.stringify(feeds))}`;

    store.saveIcon(utils.getSiteTitle(tab.url), tab.favIconUrl);
  }

  await browser.action.setPopup({
    popup: popup,
    tabId: id,
  });
};

browser.runtime.onInstalled.addListener(async details => {
  store.fixBookmarks();
  browser.alarms.create("sync-feed", {periodInMinutes:1});
  browser.contextMenus.create({
    id: "open-web-feed",
    title: "Open in WebFeed",
    contexts: ["link"],
  });
});

browser.tabs.onActivated.addListener(info => handler(info.tabId));
browser.tabs.onUpdated.addListener(id => handler(id));

browser.action.onClicked.addListener((tab) => {
  browser.tabs.create({url:browser.runtime.getURL("./list.html")});
});

browser.alarms.onAlarm.addListener(async e => utils.syncAll());

browser.contextMenus.onClicked.addListener((info, tab) => {
  store.saveIcon(utils.getSiteTitle(tab.url), tab.favIconUrl);
  let url = browser.runtime.getURL(`show.html?url=${encodeURI(info.linkUrl)}`);
  browser.tabs.create({url})
});
