'use strict';

import * as utils from "./utils.js";
import * as store from "./store.js";

let tabFeeds = {};

async function setAction(tabId, feeds) {
  if (feeds.length === 0) {
    browser.pageAction.hide(tabId);
    return;
  }

  let tab = await browser.tabs.get(tabId);
  store.saveIcon(utils.getSiteTitle(tab.url), tab.favIconUrl);

  if (feeds.length > 1) {
    await browser.pageAction.setPopup({
      tabId,
      popup: `./popup.html?links=${encodeURIComponent(JSON.stringify(feeds))}`,
    });
  } else {
    tabFeeds[tabId] = feeds[0].url;
  }

  let icon = "icons/bar-icon.svg";
  for (const feed of feeds) {
    if (await store.subscribed(feed.url)) {
      icon = "icons/icon-color.svg";
      break;
    }
  }

  await browser.pageAction.setIcon({
    path: icon,
    tabId: tabId,
  });

  browser.pageAction.show(tabId);
};

const handler = async (id) => {
  await browser.pageAction.hide(id);
  try {
    let x = await browser.scripting.executeScript({
      target: {tabId: id},
      files: ['./js/page.js'],
    });

    await setAction(id, (x[0] && x[0].result) || [])
  } catch(e) {
    await setAction(id, []);
  }
};

browser.runtime.onInstalled.addListener(async details => {
  await store.fixBookmarks();
  browser.alarms.create("sync-feed", {periodInMinutes:1});
  browser.menus.create({
    title: "Open in WebFeed...",
    contexts: ["link"],
  });
});

  browser.menus.onClicked.addListener((info, tab) => {
    const url = browser.runtime.getURL(`show.html?url=${encodeURI(info.linkUrl)}`);
    browser.tabs.create({url});
  });

  browser.tabs.onActivated.addListener(info => handler(info.tabId));
  browser.tabs.onUpdated.addListener(id => handler(id));

  browser.action.onClicked.addListener((tab) => {
    browser.tabs.create({url:browser.runtime.getURL("./list.html")});
  });

  browser.pageAction.onClicked.addListener((tab) => {
    let url = tabFeeds[tab.id];
    if (!url) {
      return;
    }

    browser.tabs.create({
      url: browser.runtime.getURL(`show.html?url=${encodeURI(url)}`),
    });
  });

  browser.alarms.onAlarm.addListener(async e => await utils.syncAll());
