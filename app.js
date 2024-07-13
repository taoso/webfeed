let fs = require('fs');
var obj = JSON.parse(fs.readFileSync('./app.json', 'utf8'));
let target = process.argv[2];
if (!target) {
  target = "chrome";
}

if (target === "chrome") {
  obj.background = {
    "service_worker": obj.background,
    "type": "module",
  };
  obj.minimum_chrome_version = "92";
} else {
  obj.background = {
    "scripts": [ obj.background ],
    "type": "module",
  };
  obj.browser_specific_settings = {
    "gecko": {
      "id": "webfeed@lehu.in",
      "strict_min_version": "128.0"
    }
  };
}
console.log(JSON.stringify(obj, null, "  "));
