#!/usr/bin/env -S npx @arcsine/nodesh
/// @ts-check
/// <reference types="/tmp/npx-scripts/arcsine.nodesh" lib="npx-scripts" />

$argv[0]
  .$dir()
  .$forEach(file => {
    console.log('Writing file', file);
    let inComment = false;

    return file
      .$readLines({ mode: 'object' })
      .$map(({ text: x }) => {
        if (!inComment) {
          if (x.includes('/*')) {
            inComment = true;
            return x.replace(/\/[*].*$/, '');
          }
        }
        if (inComment) {
          if (x.includes('*/')) {
            inComment = false;
            return x.replace(/^.*[*]\//, '');
          } else {
            return '';
          }
        }
        return x.replace(/(([ ]\/\/)|(\/\/#))[^*`\n]+/, '');
      })
      .$trim()
      .$notEmpty()
      .$writeFinal(file);
  });