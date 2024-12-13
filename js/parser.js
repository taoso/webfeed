'use strict';

// based on https://github.com/snappyjs/node-xml-stream

import * as htmlentity from './htmlentity.js';

export default class Parser {
  constructor() {
    this.state = STATE.TEXT;
    this.buffer = [];
    this.pos = 0;
    this.tagType = TAG_TYPE.NONE;
    this.finished = false;
    this.path = [];
  }

  _write(chunk) {
    for (let i = 0; i < chunk.length && !this.finished; i++) {
      let c = chunk[i];
      let prev = this.buffer[this.pos-1];
      this.buffer.push(c);
      this.pos++;

      switch (this.state) {
        case (STATE.TEXT):
          if (c === '<') this._onStartNewTag();
          break;
        case (STATE.TAG_NAME):
          if (prev === '<' && c === '?') {
            this._onStartInstruction()
          } else if (prev === '<' && c === '/') {
            this._onCloseTagStart()
          } else {
            let pp = this.buffer[this.pos-3];
            if (pp === '<' && prev === '!' && c === '[') {
              this._onCDATAStart()
            } else if (pp === '<' && prev === '!' && c === '-') {
              this._onCommentStart()
            } else if (c === '>') {
              if (prev === "/") { this.tagType |= TAG_TYPE.CLOSING; }
              this._onTagCompleted();
            }
          }
          break;
        case (STATE.INSTRUCTION):
          if (prev === '?' && c === '>') this._onEndInstruction();
          break;
        case (STATE.CDATA):
          let pp = this.buffer[this.pos-3];
          if (pp === ']' && prev === ']' && c === '>') {
            this._onCDATAEnd();
          }
          break;
        case (STATE.IGNORE_COMMENT):
          if (this.buffer[this.pos-3] === '-' && prev === '-' && c === '>') this._onCommentEnd();
          break;
      }
    }

    return this.finished;
  }

  emit(event, content, attrs) {
    attrs._path = this.path.join('/');
    content = htmlentity.unescape(content);
    if (this._emit(event, content, attrs)) {
      this.finished = true;
    }
  }

  isWhite(c) {
    switch (c) {
      case " ":
      case "\t":
      case "\v":
      case "\f":
      case "\n":
      case "\r":
      case '\uFEFF': // BOM
        return true;
      default:
        return false;
    }
  }

  _endRecording() {
    let i = 1, j = this.pos-1;
    while (this.isWhite(this.buffer[i])) i++;
    while (this.isWhite(this.buffer[j])) j--;

    let rec = this.buffer.slice(i, j);

    // Keep last item in buffer for prev comparison in main loop.
    this.buffer = this.buffer.slice(-1);
    this.pos = 1;

    if (rec[rec.length-1] === '/') rec = rec.slice(0, -1);
    if (rec[rec.length-1] === '>') rec = rec.slice(0, -2);

    return rec.join("");
  }

  _onStartNewTag() {
    let text = this._endRecording().trim();
    if (text) {
      this.emit(EVENTS.TEXT, text, {});
    }
    this.state = STATE.TAG_NAME;
    this.tagType = TAG_TYPE.OPENING;
  }

  _onTagCompleted() {
    let tag = this._endRecording();
    let { name, attributes } = this._parseTagString(tag);

    if ((this.tagType & TAG_TYPE.OPENING) == TAG_TYPE.OPENING) {
      this.path.push(name);
      this.emit(EVENTS.OPEN_TAG, name, attributes);
    }

    if ((this.tagType & TAG_TYPE.CLOSING) == TAG_TYPE.CLOSING) {
      this.emit(EVENTS.CLOSE_TAG, name, attributes);
      this.path.pop(name);
    }

    this.isCloseTag = false;
    this.state = STATE.TEXT;
    this.tagType = TAG_TYPE.NONE;
  }

  _onCloseTagStart() {
    this._endRecording();
    this.tagType = TAG_TYPE.CLOSING;
  }

  _onStartInstruction() {
    this._endRecording();
    this.state = STATE.INSTRUCTION;
  }

  _onEndInstruction() {
    this.pos -= 1; // Move position back 1 step since instruction ends with '?>'
    let inst = this._endRecording();
    let { name, attributes } = this._parseTagString(inst);
    this.emit(EVENTS.INSTRUCTION, name, attributes);
    this.state = STATE.TEXT;
  }

  _onCDATAStart() {
    this._endRecording();
    this.state = STATE.CDATA;
  }

  _onCDATAEnd() {
    // Will return CDATA[XXX]] we regexp out the actual text in the CDATA.
    let text = this._endRecording();
    text = text.slice(text.indexOf('[')+1, text.lastIndexOf(']')-1);
    this.state = STATE.TEXT;

    this.emit(EVENTS.CDATA, text, {});
  }

  _onCommentStart() {
    this.state = STATE.IGNORE_COMMENT;
  }

  _onCommentEnd() {
    this._endRecording();
    this.state = STATE.TEXT;
  }

  /**
   * Helper to parse a tag string 'xml version="2.0" encoding="utf-8"' with regexp.
   * @param  {string} str the tag string.
   * @return {object}     {name, attributes}
   */
  _parseTagString(str) {
    let [name, ...attrs] = str.split(/\s+(?=[\w:-]+=)/g);
    let attributes = {};
    attrs.forEach((attribute) => {
      let i = attribute.indexOf('=');
      let name = attribute.substr(0, i);
      let value = attribute.substr(i+1);
      attributes[name] = value.trim().replace(/"|'/g, "");
    });
    return { name, attributes };
  }
}

const STATE = {
  TEXT: 0,
  TAG_NAME: 1,
  INSTRUCTION: 2,
  IGNORE_COMMENT: 4,
  CDATA: 8
};

const TAG_TYPE = {
  NONE: 0,
  OPENING: 1,
  CLOSING: 2,
  SELF_CLOSING: 3
}

export const EVENTS = {
  TEXT: 'text',
  INSTRUCTION: 'instruction',
  OPEN_TAG: 'opentag',
  CLOSE_TAG: 'closetag',
  CDATA: 'cdata'
};
