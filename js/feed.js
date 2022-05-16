'use strict';

import { unescape as htmldecode } from './unescape.js';

const STATE = {
  FEED: 0,
  ENTRY: 1,
};

const MAX_SUMMARY = 500;

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

  constructor(url, done, maxEntries = 10) {
    this.url = url;

    this.#maxEntries = maxEntries;
    this.#done = done;
    this.#finished = false;
  }

  finish(force = false) {
    if (this.#finished) return true;
    if (!force && this.entries.length < this.#maxEntries) return false;

    this.#finished = true;

    delete this._state;
    delete this._entry;

    if (!this.link) {
      let parts = this.url.split("/");
      parts.pop();
      this.link = parts.join("/");
    }

    // Fix html entity (&#45 -> -)
    if (this.entries.length > 0 && this.entries[0].link.indexOf("&#") > 0) {
      for (let entry of this.entries) {
        entry.link = entry.link.replace(/&#(\d+);/ig, (match, p1) => {
          return String.fromCharCode(parseInt(p1, 10));
        });
      }
    }

    this.#done(this);
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
      // FIXME this.entry will be undefined in some case.
      // parse https://pinlyu.com/atom.xml
      // It seems caused by invalid encoding.
      if (this._entry) this.entries.push(this._entry);
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
      switch(attrs._last.name) {
        case "title":
          this.title = content;
          break;
        case "subtitle":
          this.description = content;
          break;
      }
    }

    if (event == "opentag" && content == "link") {
      if (!attrs.rel || attrs.rel == "alternate") {
        this.link = attrs.href;
      }
    }
  }

  emitEntry(event, content, attrs) {
    let entry = this._entry;
    if (event == "opentag" && content == "link") {
      if (!attrs.rel || attrs.rel == "alternate") {
        entry.link = attrs.href;
        if (entry.link.startsWith("/")) {
          entry.link = this.link + entry.link;
        }
      }
    }
    content = content.trim();
    if (event == "text" || event == "cdata") {
      switch(attrs._last.name) {
        case "title":
          entry.title = content;
          break;
        case "updated":
          entry.updated = new Date(content);
          break;
        case "published":
          // Do not shadow the updated field.
          if (!entry.updated) entry.updated = new Date(content);
          break;
        case "content":
          if (entry.summary) return;
          if (content.length > MAX_SUMMARY) {
            content = content.substring(0, MAX_SUMMARY)+"...";
          }
        case "summary":
          if (event == "text") {
            entry.summary = htmldecode(content);
          } else {
            entry.summary = content;
          }
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
      this.entries.push(this._entry);
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
      switch(attrs._last.name) {
        case "title":
          this.title = content;
          break;
        case "link":
          this.link = content;
          break;
        case "description":
          this.description = content;
          break;
      }
    }
  }

  emitEntry(event, content, attrs) {
    let entry = this._entry;
    if (event == "text" || event == "cdata") {
      switch(attrs._last.name) {
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
          if (event == "text") {
            entry.summary = htmldecode(content);
          } else {
            entry.summary = content;
          }
          break;
        case "pubDate":
        case "dc:date":
          entry.updated = new Date(content);
          break;
      }
    }
  }
}
