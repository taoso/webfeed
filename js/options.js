'use strict';

import { setOption, getOptionInt, setLastFetchTime } from './store.js';

async function main() {
  let form = document.getElementById("options")

  for (const input of form.elements) {
    if (input.tagName !== "INPUT") continue;

    let v = await getOptionInt(input.id);
    if (v) {
      input.value = v;
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    for (const input of e.target.elements) {
      if (input.tagName !== "INPUT") continue;

      await setOption(input.id, input.value);
      let v = await getOptionInt(input.id);
      console.debug(input.id, v);
    }
  });

  let fetchNow = document.getElementById("fetch-now")
  fetchNow.addEventListener("click", (e) => {
    setLastFetchTime(new Date("2000-01-01"));
  });
}

main().catch(e => console.error(e));

