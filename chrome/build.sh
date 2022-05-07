#!/usr/bin/env bash

cd $(dirname "$0");

rsync -a ../*.html .
rsync -a --exclude=".*" ../js/ js/
rsync -a --exclude=".*" ../css/ css/
rsync -a --exclude=".*" ../icons/ icons/
for icon in $(ls icons/|grep svg); do
	size=128
	rsvg-convert -h $size ../icons/$icon > icons/${icon%.svg}-$size.png
done

npm install --prefix js
