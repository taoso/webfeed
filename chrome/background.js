'use strict';

import { syncAll } from "./js/utils.js";
import { fixBookmarks } from "./js/store.js";

let browser = chrome;

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
      path: "icons/icon-square-128.png",
      tabId: id
    });

    popup = `./popup.html?links=${encodeURIComponent(JSON.stringify(feeds))}`;
  }

  await browser.action.setPopup({
    popup: popup,
    tabId: id,
  });
};

browser.runtime.onInstalled.addListener(async details => {
  await fixBookmarks();
  browser.alarms.create("sync-feed", {periodInMinutes:1});
});

browser.tabs.onActivated.addListener(info => handler(info.tabId));
browser.tabs.onUpdated.addListener(id => handler(id));

browser.action.onClicked.addListener((tab) => {
  browser.tabs.create({url:browser.runtime.getURL("./list.html")});
});

browser.alarms.onAlarm.addListener(async e => await syncAll());
