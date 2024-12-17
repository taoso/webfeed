(() => {
  const links = document.head.querySelectorAll("link[rel='alternate']");
  let feeds = Array.from(links).filter(link => {
    if (!link.hasAttribute("type")) return false;
    if (!link.hasAttribute("href")) return false;
    const type = link.getAttribute("type");
    if (type.indexOf("rss") !== -1 || type.indexOf("atom") !== -1) {
      return true;
    }
    return false;
  }).map(e => ({
    type: e.getAttribute("type"),
    url: e.href,
    title: e.title || document.title,
  }));

  if (feeds.length > 0) {
    return feeds;
  }

  let urls = Array.from(document.links).map(a => a.getAttribute('href'));
  urls.push(document.URL);

  feeds = urls.filter(url => {
    const patterns = [
      '/feed',
      '/rss',
      '/atom',
      'rss.xml',
      'atom.xml',
      'feed.xml',
      'feed.rss',
      'feed.atom',
      'feed.rss.xml',
      'feed.atom.xml',
      'index.xml',
      'index.rss',
      'index.atom',
      'index.rss.xml',
      'index.atom.xml',
      '?format=rss',
      '?format=atom',
      '?rss=1',
      '?atom=1',
      '?feed=rss',
      '?feed=rss2',
      '?feed=atom',
      '.rss',
    ];

    url = url.toLowerCase();
    for (const p of patterns) {
      if (url.indexOf(p) !== -1) {
        return true;
      }
    }
    return false;
  }).map(url => ({
      type: "link",
      url: url,
      title: url,
    }));

  return feeds;
})();
