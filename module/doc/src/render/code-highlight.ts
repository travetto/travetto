import { default as prismjs } from 'prismjs';

import 'prismjs/plugins/normalize-whitespace/prism-normalize-whitespace.js';
import 'prismjs/components/prism-typescript.js';
import 'prismjs/components/prism-javascript.js';
import 'prismjs/components/prism-css.js';
import 'prismjs/components/prism-jsx.js';
import 'prismjs/components/prism-scss.js';
import 'prismjs/components/prism-yaml.js';
import 'prismjs/components/prism-json.js';
import 'prismjs/components/prism-sql.js';
import 'prismjs/components/prism-properties.js';
import 'prismjs/components/prism-bash.js';

prismjs.plugins.NormalizeWhitespace.setDefaults({
  'remove-trailing': true,
  'remove-indent': true,
  'left-trim': true,
  'right-trim': true
});

const nw = prismjs.plugins.NormalizeWhitespace;

const tokenMapping: { [key: string]: string } = {
  gt: '>',
  lt: '<',
  quot: '"',
  apos: "'"
};

export function highlight(text: string, lang: string): string | undefined {
  text = nw.normalize(text, {
    indent: 0
  });

  text = text
    .replace(/&#(\d+);/g, (x, code) => String.fromCharCode(code))
    .replace(/&([a-z][^;]*);/g, (a, k) => tokenMapping[k] || a);

  try {
    return prismjs.highlight(text, prismjs.languages[lang], lang)
      .replace(/(@\s*<span[^>]*)function("\s*>)/g, (a, pre, post) => `${pre}meta${post}`)
      .replace(/[{}]/g, a => `{{'${a}'}}`);
  } catch (err) {
    if (err instanceof Error) {
      console.error(err.message, { error: err });
    } else {
      throw err;
    }
  }
}

