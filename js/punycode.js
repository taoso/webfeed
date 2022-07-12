'use strict';

// Extracted from https://github.com/cook-code-jazor/punycode

var B = 1;
var w = 26;
var A = 36;
var s = 128;
var C = 72;
var z = 700;
var r = 38;
var t = "-";
var u = 2147483647;
var v = {};
var o = function(d, c) {
  return Math.floor(d / c)
};
var x = function(a, c, b) {
  a = o(a, b ? z : 2);
  a = a + o(a, c);
  var d = 0;
  while (a > o((A - B) * w, 2)) {
    a = o(a, A - B);
    d = d + A
  }
  return d + o((A - B + 1) * a, a + r)
};
var p = function(a) {
  return a < 128
};
var q = function(a) {
  if (a < 26) {
    return a + "a".charCodeAt(0)
  } else {
    if (a < 36) {
      return a - 26 + "0".charCodeAt(0)
    } else {
      return 0
    }
  }
};
var y = function(a) {
  if (a - "0".charCodeAt(0) < 10) {
    return a - "0".charCodeAt(0) + 26
  } else {
    if (a - "a".charCodeAt(0) < 26) {
      return a - "a".charCodeAt(0)
    } else {
      return 0
    }
  }
};

export function toIDN(c) {
  var b = c.split(".");
  var a = 0;
  var d = "";
  for (a = 0; a < b.length; a++) {
    if (/^[0-9a-zA-Z\\-]+$/igm.test(b[a])) {
      d += b[a] + "."
    } else {
      d += "xn--" + encode(b[a]) + "."
    }
  }
  if (d != "") {
    d = d.substr(0, d.length - 1)
  }
  return d
};

export function fromIDN(d) {
  var c = d.split(".");
  var a = 0;
  var e = "";
  for (a = 0; a < c.length; a++) {
    var b = c[a];
    if (b.toLowerCase().indexOf("xn--") == 0) {
      e += decode(b.substr(4)) + "."
    } else {
      e += b + "."
    }
  }
  if (e != "") {
    e = e.substr(0, e.length - 1)
  }
  return e
};

export function encode(d) {
  var e = s;
  var c = 0;
  var i = C;
  var b = "";
  var g = 0;
  d = d.split("");
  for (var k = 0; k < d.length; k++) {
    var h = d[k].charCodeAt(0);
    if (p(h)) {
      b += d[k];
      g++
    }
  }
  if (g > 0) {
    b += t
  }
  var j = g;
  while (j < d.length) {
    var n = u;
    for (var k = 0; k < d.length; k++) {
      var h = d[k].charCodeAt(0);
      if (h >= e && h < n) {
        n = h
      }
    }
    if (n - e > o(u - c, j + 1)) {
      return ""
    }
    c = c + (n - e) * (j + 1);
    e = n;
    for (var l = 0; l < d.length; l++) {
      var h = d[l].charCodeAt(0);
      if (h < e) {
        c++;
        if (0 == c) {
          return ""
        }
      }
      if (h == e) {
        var f = c;
        for (var m = A;; m += A) {
          var a;
          if (m <= i) {
            a = B
          } else {
            if (m >= i + w) {
              a = w
            } else {
              a = m - i
            }
          } if (f < a) {
            break
          }
          b += String.fromCharCode(q(a + (f - a) % (A - a)));
          f = o(f - a, A - a)
        }
        b += String.fromCharCode(q(f));
        i = x(c, j + 1, j == g);
        c = 0;
        j++
      }
    }
    c++;
    e++
  }
  return b
};

export function decode(e) {
  var f = s;
  var l = 0;
  var k = C;
  var d = "";
  var j = e.lastIndexOf(t);
  e = e.split("");
  if (j > 0) {
    for (var m = 0; m < j; m++) {
      var i = e[m].charCodeAt(0);
      if (!p(i)) {
        return ""
      }
      d += e[m]
    }
    j++
  } else {
    j = 0
  }
  while (j < e.length) {
    var h = l;
    var c = 1;
    for (var b = A;; b += A) {
      if (j == e.length) {
        return ""
      }
      var i = e[j++].charCodeAt(0);
      var g = y(i);
      if (g > o(u - l, c)) {
        return ""
      }
      l = l + g * c;
      var a;
      if (b <= k) {
        a = B
      } else {
        if (b >= k + w) {
          a = w
        } else {
          a = b - k
        }
      } if (g < a) {
        break
      }
      c = c * (A - a)
    }
    k = x(l - h, d.length + 1, h == 0);
    if (o(l, d.length + 1) > u - f) {
      return ""
    }
    f = f + o(l, d.length + 1);
    l = l % (d.length + 1);
    var n = String.fromCharCode(f);
    if (l == 0) {
      d = n + d
    } else {
      d = d.substr(0, l) + n + d.substr(l)
    }
    l++
  }
  return d
};
