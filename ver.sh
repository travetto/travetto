#!/bin/sh
V=`npm info @travetto/$1 versions | tr "'" '"' | jq  | grep '0.7' | grep -v alpha | sed -e 's|[^0-9.]||g' | sort -nr | head -n1`
npm dist-tag add @travetto/$1@$V latest --otp="$2"
