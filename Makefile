SVGs := $(shell find ./icons -name '*.svg')
PNGs := $(SVGs:.svg=.png)

%.png: %.svg
	rsvg-convert -h 128 $< > $@

npm:
	npm install --prefix js

sync: npm $(PNGs)
	rsync --delete -avP css *.html icons js ./event.js build/

chrome: sync
	node ./app.js chrome > build/manifest.json

firefox: sync
	node ./app.js firefox > build/manifest.json
