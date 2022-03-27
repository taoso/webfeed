'use strict';

const STATE = {
  FEED: 0,
  ENTRY: 1,
};

const MAX_SUMMARY = 500;

export class AtomFeed {
  #state;
  #entry;
  #maxEntries;
  #done;
  #finished;

  constructor(parser, done, maxEntries = 10) {
    this.title = "";
    this.description = "";
    this.link = "";
    this.entries = [];

    this.#maxEntries = maxEntries;
    this.#done = done;
    this.#finished = false;

    parser.emit = this.emitAll.bind(this);
  }

  finish() {
    if (this.#finished) return;
    this.#finished = true;
    this.#done(this);
  }

  emitAll(event, content, attrs) {
    if (this.entries.length >= this.#maxEntries) {
      this.finish();
      return;
    }

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
      this.entries.push(this.#entry);
      this.#state = STATE.FEED;
      return;
    }

    if (event == "closetag" && content == "feed") {
      this.finish();
      return;
    }

    switch (this.#state) {
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

    if (event == "opentag" && content == "link" && attrs.rel != "self") {
      this.link = attrs.href;
    }
  }

  emitEntry(event, content, attrs) {
    let entry = this.#entry;
    if (event == "opentag" && content == "link") {
      if (!attrs.rel || attrs.rel == "alternate") {
        entry.link = attrs.href;
      }
    }
    content = content.trim();
    if (event == "text" || event == "cdata") {
      switch(attrs._last.name) {
        case "title":
          entry.title = content;
          break;
        case "updated":
          entry.updated = content;
          break;
        case "summary":
        case "content":
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
      }
    }
  }
}

export class RssFeed {
  #state;
  #entry;
  #maxEntries;
  #done;
  #finished;

  constructor(parser, done, maxEntries = 10) {
    this.title = "";
    this.link = "";
    this.description = "";
    this.entries = [];

    this.#maxEntries = maxEntries;
    this.#done = done;
    this.#finished = false;

    parser.emit = this.emitAll.bind(this);
  }

  finish() {
    if (this.#finished) return;
    this.#finished = true;
    this.#done(this);
  }

  emitAll(event, content, attrs) {
    if (this.entries.length >= this.#maxEntries) {
      this.finish();
      return;
    }

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
      this.entries.push(this.#entry);
      this.#state = STATE.FEED;
      return;
    }

    if (event == "closetag" && content == "rss") {
      this.finish();
      return;
    }

    switch (this.#state) {
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
    let entry = this.#entry;
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
          entry.updated = content;
          break;
      }
    }
  }
}

function htmldecode(str) {
  var txt = document.createElement('textarea');
  txt.innerHTML = str;
  return txt.value;
}
