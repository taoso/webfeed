'use strict';

import Parser from './parser.js';

const STATE = {
  FEED: 0,
  ENTRY: 1,
};

const MAX_SUMMARY = 2048;

export class Feed {
  url = "";
  link = "";
  title = "";
  description = "";
  entries = [];

  #state;
  #entry;
  #maxEntries;
  #done;
  #finished;
  #parser;

  constructor(url, maxEntries = 10) {
    this.url = url;

    this.#maxEntries = maxEntries;
    this.#finished = false;

    this.#parser = new Parser();
    this.#parser._emit = this.emitAll.bind(this);
  }

  emitAll(event, content, attrs) {
    if (event == "instruction") return;
    if (event == "opentag" && content == "feed") {
      this.#parser._emit = this.emitAtomAll.bind(this);
    } else if (event == "opentag" && content == "rss") {
      this.#parser._emit = this.emitRssAll.bind(this);
    } else {
      throw new Error(`invalid feed from ${this.url}`);
    }
  }

  write(chunk) {
    return this.#parser._write(chunk);
  }

  _fixFeedLink() {
    if (!this.link.startsWith("http")) {
      let url = new URL(this.url);
      this.link = url.origin;
    }
  }

  _fixLink(entry) {
    if (!entry.link.startsWith("http")) {
      entry.link = this.link + entry.link;
    }
  }

  finish(force = false) {
    if (this.#finished) return true;
    if (!force && this.entries.length < this.#maxEntries) return false;

    this.#finished = true;

    return true;
  }

  emitAtomAll(event, content, attrs) {
    if (this.finish()) { return true; }

    if (event == "opentag" && content == "feed") {
      this.#state = STATE.FEED;
      return;
    }

    if (event == "opentag" && content == "entry") {
      this.#entry = {};
      this.#state = STATE.ENTRY;
      return;
    }

    if (event == "closetag" && content == "entry") {
      let entry = this.#entry;
      if (entry.link) {
        if (entry.summary && entry.summary.length > MAX_SUMMARY) {
          entry.summary = entry.summary.slice(0, MAX_SUMMARY);
        }
        this.entries.push(entry);
      }
      this.#state = STATE.FEED;
      return;
    }

    if (event == "closetag" && content == "feed") {
      this.finish(true);
      return true;
    }

    switch (this.#state) {
      case STATE.ENTRY:
        this.emitAtomEntry(event, content, attrs);
        break;
      default:
        this.emitAtomFeed(event, content, attrs);
    }
  }

  emitAtomFeed(event, content, attrs) {
    if (event == "text" || event == "cdata") {
      switch(attrs._path) {
        case "feed/title":
          this.title = content;
          break;
        case "feed/subtitle":
          this.description = content;
          break;
      }
    }

    if (event == "opentag" && attrs._path == "feed/link") {
      if (!attrs.rel || attrs.rel == "alternate") {
        this.link = attrs.href;
        this._fixFeedLink();
      }
    }
  }

  emitAtomEntry(event, content, attrs) {
    let entry = this.#entry;
    if (event == "opentag" && attrs._path == "feed/entry/link") {
      if (!attrs.rel || attrs.rel == "alternate") {
        entry.link = attrs.href;
        this._fixLink(entry);
      }
    }
    content = content.trim();
    if (event == "text" || event == "cdata") {
      switch(attrs._path.slice("feed/entry/".length)) {
        case "title":
          entry.title = content;
          break;
        case "updated":
        case "modified":
          // Do not shadow the updated field.
          if (!entry.updated) entry.updated = new Date(content);
          break;
        case "published":
          entry.updated = new Date(content);
          break;
        case "content":
          if (entry.summary) return;
        case "summary":
          entry.summary = content;
          break;
      }
    }
  }

  emitRssAll(event, content, attrs) {
    if (this.finish()) { return true; }

    if (event == "opentag" && content == "channel") {
      this.#state = STATE.FEED;
      return;
    }

    if (event == "opentag" && content == "item") {
      this.#entry = {};
      this.#state = STATE.ENTRY;
      return;
    }

    if (event == "closetag" && content == "item") {
      if (this.#entry) { this.entries.push(this.#entry); }
      this.#state = STATE.FEED;
      return;
    }

    if (event == "closetag" && content == "rss") {
      this.finish(true);
      return true;
    }

    switch (this.#state) {
      case STATE.ENTRY:
        this.emitRssEntry(event, content, attrs);
        break;
      default:
        this.emitRssFeed(event, content, attrs);
    }
  }

  emitRssFeed(event, content, attrs) {
    if (event == "text" || event == "cdata") {
      switch(attrs._path) {
        case "rss/channel/title":
          this.title = content;
          break;
        case "rss/channel/link":
          this.link = content;
          this._fixFeedLink();
          break;
        case "rss/channel/description":
          this.description = content;
          break;
      }
    }
  }

  emitRssEntry(event, content, attrs) {
    let entry = this.#entry;
    if (event == "text" || event == "cdata") {
      switch(attrs._path.slice("rss/channel/item/".length)) {
        case "title":
          entry.title = content;
          break;
        case "link":
          if (!attrs.rel || attrs.rel == "alternate") {
            entry.link = content;
            this._fixLink(entry);
          }
          break;
        case "description":
        case "content:encoded":
          if (entry.summary) {
            return;
          }
          entry.summary = content;
          break;
        case "pubDate":
        case "dc:date":
          entry.updated = new Date(content);
          break;
      }
    }
  }
}
