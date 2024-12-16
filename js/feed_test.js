'use strict';

import * as feed from './feed.js';
import fs from 'node:fs';

let xmlPath = './test/input/';
let jsonPath = './test/output/';

fs.readdirSync(xmlPath).map(fileName => {
  let p = xmlPath + fileName;
  fs.readFile(p, (err, data) => {
    if (err) {
      console.error("read file", p, err);
      return;
    }

    let f = new feed.Feed("https://example.com", 2);
    f.write(data);

    let json = JSON.stringify(f, null, 2);
    fs.readFile(jsonPath + fileName + '.json', 'utf8', (err, data) => {
      if (err) {
        console.error("read file", p, err);
        return;
      }
      if (json != data) {
        console.error("invalid feed", p);
        process.exit(1);
      }
    });
  });
});
