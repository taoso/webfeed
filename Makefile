SVGs := $(shell find ./icons -name '*.svg')
PNGs := $(SVGs:.svg=.png)

%.png: %.svg
	rsvg-convert -h 256 $< > $@

npm:
	npm install --prefix js

sync: npm $(PNGs)
	rsync --delete-after --delete-excluded -avP \
		--exclude="js/node_modules/.package-lock.json" \
		--exclude="js/package-lock.json" \
		--exclude="js/package.json" \
		--exclude="icons/*.svg" \
		css *.html icons js event.js \
		build/

chrome: sync
	node ./app.js chrome > build/manifest.json

firefox: sync
	node ./app.js firefox > build/manifest.json
