'use strict';

import * as utils from "./js/utils.js";
import * as store from "./js/store.js";

let browser = self.browser || self.chrome;

const handler = async (id) => {
  let tab;
  try {
    tab = await browser.tabs.get(id);
  } catch (e) {
    console.log(e);
    return;
  }

  let feeds = [];

  if (tab.url && tab.url.startsWith("http")) {
    try {
      let x = await browser.scripting.executeScript({
        target: {tabId: id},
        files: ['./js/page.js'],
      });

      feeds = x[0].result || [];
      feeds = [...new Map(feeds.map(f => [f.url, f])).values()];
    } catch (e) {
      console.error(e);
    }
  }

  let popup = "";
  if (feeds.length > 0) {
    await browser.action.setIcon({
      path: { "128": "icons/icon.png" },
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
});

browser.tabs.onActivated.addListener(info => handler(info.tabId));
browser.tabs.onUpdated.addListener(id => handler(id));

browser.action.onClicked.addListener((tab) => {
  browser.tabs.create({url:browser.runtime.getURL("./list.html")});
});

browser.alarms.onAlarm.addListener(async e => utils.syncAll());
