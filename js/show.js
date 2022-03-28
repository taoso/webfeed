'use strict';

import Parser from "./parser.js";
import { AtomFeed, RssFeed } from './feed.js';

async function subscribe(data) {
  let bs = await browser.bookmarks.search({title:"[web-feed]"});
  if (bs.length > 0) {
    var id = bs[0].id;
  } else {
    let b = await browser.bookmarks.create({title:"[web-feed]"});
    var id = b.id
  }

  bs = await browser.bookmarks.search({url:data.url});
  if (bs.length > 0) {
  }

  await browser.bookmarks.create({
    title: `${data.title}[${data.link}]`,
    url: data.url,
    parentId: id,
  });
}

async function renderHTML(feed) {
  let header = document.querySelector('body header');
  let h1 = header.querySelector('h1 a')
  h1.href = feed.link;
  h1.innerHTML = feed.title;

  let button = header.querySelector('subscribe-button')
  button.dataset.url = feed.url
  button.dataset.link = feed.link
  button.dataset.title = feed.title

  let bs = await browser.bookmarks.search({url:feed.url});
  if (bs.length > 0) {
    button.innerHTML = "Unsubscribe";
  } else {
    button.innerHTML = "Subscribe";
  }

  button.onclick = async (e) => {
    if (button.innerHTML == "Subscribe") {
      await subscribe(e.target.dataset);
      button.innerHTML = "Unsubscribe";
    } else {
      let bs = await browser.bookmarks.search({url:feed.url});
      await browser.bookmarks.remove(bs[0].id);
      button.innerHTML = "Subscribe";
    }
  };

  let feedLink = header.querySelector('#feed-link')
  feedLink.href = feed.url;
  feedLink.innerHTML = feed.url;

  const template = document.getElementById("feed-item");

  let rewriteRefer = (e) => {
    for (let header of e.requestHeaders) {
      if (header.name.toLowerCase() === "user-agent") {
        header.value += " WebFeed";
      }
    }
    e.requestHeaders.push({name:"Referer", value:feed.url})
    return {requestHeaders: e.requestHeaders};
  }

  browser.webRequest.onBeforeSendHeaders.addListener(
    rewriteRefer,
    {urls: ["*://*/*"]},
    ["blocking", "requestHeaders"]
  );

  feed.entries.forEach(entry => {
    const content = template.content.cloneNode(true);

    content.querySelector("article>h2").innerHTML = entry.title;
    content.querySelector("article>time").innerHTML = entry.updated;
    content.querySelector("article>div").innerHTML = entry.summary;
    content.querySelector("article>a").href = entry.link;

    content.querySelectorAll("article>div img").forEach(img => {
      if (img.dataset.src) {
        img.src = img.dataset.src;
      }
      img.src = fixLink(img.src, feed.url);
    });
    content.querySelectorAll("article>div a").forEach(a => {
      a.href = fixLink(a.href, feed.url);
    });

    document.querySelector(".items").appendChild(content);
  });
}

function fixLink(link, feedLink) {
  if (!link.startsWith("http")) {
    let url = new URL(link);
    let feedUrl = new URL(feedLink);
    return feedUrl.protocol + "//" + feedUrl.host + url.pathname;
  }
  return link;
}

async function parse(reader, url) {
  const { value, done } = await reader.read();

  const utf8Decoder = new TextDecoder("utf-8");

  let chunk = utf8Decoder.decode(value, {stream: true});

  let parser = new Parser();
  let num = 10;

  let render = async (feed) => {
    reader.cancel();
    await renderHTML(feed);
  };

  if (chunk.includes("rss")) {
    var feed = new RssFeed(parser, render, num);
  } else {
    var feed = new AtomFeed(parser, render, num);
  }

  feed.url = url;

  parser._write(chunk);

  while (!done) {
    const { value, done } = await reader.read();
    if (done) break;
    let chunk = utf8Decoder.decode(value, {stream: true});
    parser._write(chunk);
  };
}

async function main() {
  let url = decodeURI(window.location.search.substr(5));
  if (url.indexOf("ext%2Brss%3A") === 0) {
    url = decodeURIComponent(url.substr(12));
    window.location.replace("/show.html?url=" + encodeURI(url));
  }

  try {
    var resp = await fetch(url);
    if (resp.status >= 400) {
      const notFound = document.createElement("div");
      notFound.innerHTML = `
        <div>
          <h1>404</h1>
          <p>Feed <a href="${url}">${url}</a> not found</p>
        </div>
      `;
      document.body.appendChild(notFound);
      return;
    }
  } catch (e) {
    const error = document.createElement("div");
    error.innerHTML = `
        <div>
          <h1>Error</h1>
          <p>Error while fetching feed</p>
          <a href="${url}">${url}</a>
        </div>
      `;
    document.body.appendChild(error);
    return;
  }

  await parse(resp.body.getReader(), url);
}

main().catch(e => console.error(e));
