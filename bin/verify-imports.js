#!/usr/bin/env -S npx @arcsine/nodesh
/// @ts-check
/// <reference types="/tmp/npx-scripts/arcsine.nodesh" lib="npx-scripts" />

const groupTypeMap = {
  preface: ['preface', 'node', 'travetto', 'local'],
  node: ['node', 'travetto', 'local'],
  travetto: ['travetto', 'local'],
  local: ['local'],
};

const getLinetype = (line) =>
  /#!/.test(line) ? 'preface' :
    /^\/\/\/ <reference/.test(line) ? 'preface' :
      /^\/\/ @file-if/.test(line) ? 'preface' :
        /((import (\w|[*,{} ])* from)|import|(^|[}]) from) '@travetto/.test(line) ? 'travetto' :
          /((import (\w|[*,{} ])* from)|import|(^|[}]) from) '[^.]/.test(line) ? 'node' :
            /^const \w+ = require\(/.test(line) ? 'node' :
              /((import (\w|[*,{} ])* from)|import|(^|[}]) from) '[.]/.test(line) ? 'local' :
                /^\s*$/.test(line) ? 'line' :
                  'unhandled';

'{module,related}/**/*.ts'
  .$dir()
  .$filter(x => !x.includes('node_modules'))
  .$parallel(f => f
    .$readLines({ mode: 'object' })
    .$map(l => ({ ...l, text: l.text.replace(/\/\/ .*$/, '') }))
    .$collect()
    .$map(all => {
      let groupType = '';
      let groupSize = 0;
      let contiguous = false;

      const isDoc = /module\/[^/]+\/doc\//.test(f);

      for (const { number, text: line } of all) {
        const lineType = getLinetype(line);

        if (isDoc && lineType === 'local' && /[.][.]/.test(line)) {
          return `${f}:${number} - Doc does not support local`;
        }

        switch (lineType) {
          case 'unhandled': continue;
          case 'line': contiguous = false; groupSize = 0; continue;
        }

        if (groupType && !groupTypeMap[groupType].includes(lineType)) {
          return `${f}:${number} - Invalid transition`;
        }

        if (groupType === lineType) {
          groupSize += 1;
        }

        if (groupSize === 0) { // New group, who dis
          groupSize = 1;
          groupType = lineType;
        } else if (groupType === lineType && !contiguous) { // Contiguous same
          // Do nothing
        } else if (groupSize === 1) { // Contiguous diff, count 1
          contiguous = true;
          groupType = lineType;
        } else { // Contiguous diff, count > 1
          return `${f}:${number} - Invalid contiguous groups`;
        }
      }

      const tokens = new Set();
      const lines = all
        .map(l => l.text).join('~~')
        .replace(/import (?:type )?((?:\w|[*])+) from/g, (_, vals) => {
          vals
            .replace(/(?:\w|[*])+ as (\w+)/g, (__, v) => { tokens.add(v); return ''; })
            .replace(/\w+/g, v => tokens.add(v));
          return 'import from';
        })
        .split(/~~/g);

      for (const line of lines) {
        line.replace(/\w+/g, v => `${tokens.delete(v)}`);
      }
      if (tokens.size) {
        return `${f} - Unused import ${[...tokens].join(' ')}`;
      }
    })
  )
  .$notEmpty()
  .$console;