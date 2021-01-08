#!/bin/sh
rm -rf module/boot/src/
find module -name 'node_modules' -type d | xargs rm -rf
find . -name '.trv_cache*' -type d | xargs rm -rf