'use strict';

import Parser from './parser.js';

const STATE = {
  FEED: 0,
  ENTRY: 1,
};

const MAX_SUMMARY = 2048;

class Feed {
  link = "";
  title = "";
  description = "";
  entries = [];

  _state;
  _entry;

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

  write(chunk) {
    return this.#parser._write(chunk);
  }

  finish(force = false) {
    if (this.#finished) return true;
    if (!force && this.entries.length < this.#maxEntries) return false;

    this.#finished = true;

    delete this._state;
    delete this._entry;

    if (!this.link.startsWith("http")) {
      let url = new URL(this.url);
      this.link = url.origin;
    }

    return true;
  }
}

export class AtomFeed extends Feed {
  emitAll(event, content, attrs) {
    if (this.finish()) { return true; }

    if (event == "opentag" && content == "feed") {
      this._state = STATE.FEED;
      return;
    }

    if (event == "opentag" && content == "entry") {
      this._entry = {};
      this._state = STATE.ENTRY;
      return;
    }

    if (event == "closetag" && content == "entry") {
      if (this._entry) { this.entries.push(this._entry); }
      this._state = STATE.FEED;
      return;
    }

    if (event == "closetag" && content == "feed") {
      this.finish(true);
      return true;
    }

    switch (this._state) {
      case STATE.ENTRY:
        this.emitEntry(event, content, attrs);
        break;
      default:
        this.emitFeed(event, content, attrs);
    }
  }

  emitFeed(event, content, attrs) {
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
      }
    }
  }

  emitEntry(event, content, attrs) {
    let entry = this._entry;
    if (event == "opentag" && attrs._path == "feed/entry/link") {
      if (!attrs.rel || attrs.rel == "alternate" || attrs.rel == "self") {
        entry.link = attrs.href;
        if (entry.link.startsWith("/")) {
          entry.link = this.link + entry.link;
        }
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
          if (content.length > MAX_SUMMARY) {
            content = content.substring(0, MAX_SUMMARY)+"...";
          }
        case "summary":
          entry.summary = content;
          break;
      }
    }
  }
}

export class RssFeed extends Feed {
  emitAll(event, content, attrs) {
    if (this.finish()) { return true; }

    if (event == "opentag" && content == "channel") {
      this._state = STATE.FEED;
      return;
    }

    if (event == "opentag" && content == "item") {
      this._entry = {};
      this._state = STATE.ENTRY;
      return;
    }

    if (event == "closetag" && content == "item") {
      if (this._entry) { this.entries.push(this._entry); }
      this._state = STATE.FEED;
      return;
    }

    if (event == "closetag" && content == "rss") {
      this.finish(true);
      return true;
    }

    switch (this._state) {
      case STATE.ENTRY:
        this.emitEntry(event, content, attrs);
        break;
      default:
        this.emitFeed(event, content, attrs);
    }
  }

  emitFeed(event, content, attrs) {
    if (event == "text" || event == "cdata") {
      switch(attrs._path) {
        case "rss/channel/title":
          this.title = content;
          break;
        case "rss/channel/link":
          this.link = content;
          break;
        case "rss/channel/description":
          this.description = content;
          break;
      }
    }
  }

  emitEntry(event, content, attrs) {
    let entry = this._entry;
    if (event == "text" || event == "cdata") {
      switch(attrs._path.slice("rss/channel/item/".length)) {
        case "title":
          entry.title = content;
          break;
        case "link":
          if (!attrs.rel || attrs.rel == "alternate") {
            entry.link = content;
          }
          break;
        case "description":
        case "content:encoded":
          if (entry.summary) {
            return;
          }
          if (content.length > MAX_SUMMARY) {
            content = content.substring(0, MAX_SUMMARY)+"...";
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
