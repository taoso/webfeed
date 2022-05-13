'use strict';

import { syncAll } from "./utils.js";
import { fixBookmarks, subscribed } from "./store.js";

let tabFeeds = {};

async function setAction(tabId, feeds) {
  if (feeds.length === 0) {
    browser.pageAction.hide(tabId);
    return;
  }

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
    if (await subscribed(feed.url)) {
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
    let x = await browser.tabs.executeScript(id, {
      file: "./js/page.js",
      runAt: "document_end",
    });

    await setAction(id, x[0] || [])
  } catch(e) {
    await setAction(id, []);
  }
};

async function main() {
  browser.tabs.onActivated.addListener(info => handler(info.tabId));
  browser.tabs.onUpdated.addListener(id => handler(id));

  browser.menus.create({
    title: "Open in Web Feed...",
    contexts: ["link"],
    onclick: (info, tab) => {
      const url = browser.runtime.getURL(`show.html?url=${encodeURI(info.linkUrl)}`);
      browser.tabs.create({url});
    }
  });

  browser.browserAction.onClicked.addListener((tab) => {
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

  browser.alarms.create("sync-feed", {periodInMinutes:1});
  browser.alarms.onAlarm.addListener(async e => await syncAll());

  browser.runtime.onInstalled.addListener(async details => {
    await fixBookmarks();
  });
};

main().catch(e => console.error(e));
