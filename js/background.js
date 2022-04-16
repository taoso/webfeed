'use strict';

import { syncAll, setBadge } from "./utils.js";
import { openDB } from "./store.js";

let tabFeeds = {};

function setAction(tabId, feeds) {
  if (feeds.length === 0) {
    browser.pageAction.hide(tabId);
    return;
  }

  if (feeds.length > 1) {
    browser.pageAction.setPopup({
      tabId,
      popup: `./popup.html?links=${encodeURIComponent(JSON.stringify(feeds))}`,
    });
  } else {
    tabFeeds[tabId] = feeds[0].url;
  }

  browser.pageAction.show(tabId);
};

const handler = async (id) => {
  browser.pageAction.hide(id);
  browser.tabs
    .executeScript(id, {
      file: "./js/page.js",
      runAt: "document_end",
    })
    .then(x => {
      setAction(id, x[0] ? x[0]: [])
    })
    .catch(e => {
      setAction(id, []);
    });
};

async function main() {
  browser.tabs
    .query({
      active: true,
    })
    .then(tabs => {
      for (const tab of tabs) {
        tab.id && handler(tab.id);
      }
    });

  browser.tabs.onActivated.addListener(info => handler(info.tabId));
  browser.tabs.onUpdated.addListener(id => handler(id));

  browser.contextMenus.create({
    title: "Open in Web Feed",
    contexts: ["link"],
    onclick: (info, tab) => {
      const url = browser.runtime.getURL(`show.html?url=${encodeURI(info.linkUrl)}`);
      let creating = browser.tabs.create({ url: url });
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
};

main().catch(e => console.error(e));
