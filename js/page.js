(() => {
  const links = document.head.querySelectorAll("link[rel='alternate']")
  const feeds = Array.from(links) 
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

  return feeds;
})();

