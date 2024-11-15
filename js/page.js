(() => {
  const links = document.head.querySelectorAll("link[rel='alternate']");
  let feeds = Array.from(links)
  .filter(el => {
    if (!el.hasAttribute("type")) return false;
    if (!el.hasAttribute("href")) return false;
    const type = el.getAttribute("type");
    if (type.indexOf("rss") !== -1 || type.indexOf("atom") !== -1) {
      return true;
    }
    return false;
  })
  .map(el => ({
    type: el.getAttribute("type"),
    url: el.href,
    title: el.title || document.title,
  }));

  if (feeds.length === 0) {
    feeds = Array.from(document.links)
      .filter(el => {
        if (!el.hasAttribute("href")) return false;
        const href = el.getAttribute("href");
        if (href.indexOf("rss") !== -1 || href.indexOf("atom") !== -1 || href.indexOf(".xml") !== -1) {
          return true;
        }
        return false;
      }).map(el => ({
        type: "link",
        url: el.href,
        title: el.href,
      }));
  }

  return feeds;
})();

