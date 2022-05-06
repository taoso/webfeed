'use strict';

const es = /&(?:amp|lt|gt|apos|quot|#\d+|#x\d+);/g;

const unes = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&apos;': "'",
  '&quot;': '"',
  '&num;': '#',
};

const cape = (m) => {
  if (m.startsWith("&#x")) {
    return String.fromCharCode(parseInt(m.slice(3,-1), 16));
  }
  if (m.startsWith("&#")) {
    return String.fromCharCode(parseInt(m.slice(2,-1)));
  }
  return unes[m] || m;
};

export const unescape = un => un.replace(es, cape);
