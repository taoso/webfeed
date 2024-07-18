'use strict';

let browser = self.browser || self.chrome;

import * as store from './store.js';

async function main() {
  const items = document.querySelector(".items");
  const template = document.getElementById("log-item");
  const summary = document.querySelector(".summary");

  let fetchlog = await store.getFetchLog();

  if (fetchlog.begin) {
    let d = new Date(fetchlog.begin).toLocaleString();
    summary.querySelector("#begin").innerText = d;
  }
  if (fetchlog.begin) {
    let d = new Date(fetchlog.end).toLocaleString();
    summary.querySelector("#end").innerText = d;
  }
  summary.querySelector("#feedNum").innerText = fetchlog.feedNum || 0;
  summary.querySelector("#newNum").innerText = fetchlog.newNum || 0;
  summary.querySelector("#cleanNum").innerText = fetchlog.cleanNum || 0;

  const infos = {
    "notfound": {
      title: "Not Found",
      desc: `<p>It seems that the server may delete these Feeds.</p>
<p>However, this may be a temporary server side mistake.</p>
<p>If one feed occures several times in this list, You may unsubscribe them.</p>`
    },
    "malformed": {
      title: "Malformed",
      desc: `<p>The format of feed content is invalid.</p>
<p>However, this may be a temporary server side mistake.</p>
<p>If one feed occures several times in this list, you may unsubscribe them.</p>`
    },
    "redirected": {
      title: "Redirected",
      desc: `<p>New location of feed found.
<p>The original feed link may be deleted in the future.</p>
<p>You may update the link by first unsubscribe and then resubscribe them.</p>`
    },
    "timeout": {
      title: "Timeout",
      desc: `<p>Cannot get the following feeds because of timeout.</p>
<p>This error may be caused by the slow speed either of your network or the servers,
or caused by a small timeout option.<p>
<p>This may be temporary errors.</p>
<p>If some feeds always timeout, You need to checkout if you can access the server.</p>
<p>Or you may adjust the timeout options in <a href="options.html" target="_blank">here</a>.</p>`
    },
    "error": {
      title: "Other Errors",
      desc: `<p>Can not get the feed because of other errors.</p>
<p>This errors may be caused by invalid domain name or unaccessable server.</p>
<p>This may be temporary errors!</p>
<p>You need to check whether these feeds' server is reachable.</p>`
    },
  };

  for (const type of ["notfound", "malformed", "redirected", "timeout", "error"]) {
    let urls = fetchlog[type] || [];

    if (urls.length === 0) {
      continue;
    }

    const content = template.content.cloneNode(true);
    let $ = content.querySelector.bind(content);

    let info = infos[type];

    $('.type').innerText = info.title;
    $('.error').innerHTML = info.desc;
    let ol = $('.urls');
    for (const url of urls) {
      let li = document.createElement('li');
      let showUrl = browser.runtime.getURL(`show.html?url=${encodeURI(url)}`);
      li.innerHTML = `<a href="${showUrl}" target="_blank">${url}</a>`;
      ol.appendChild(li);
    }

    content.appendChild(ol);
    items.appendChild(content);
  }
}

main().catch(e => console.error(e));
