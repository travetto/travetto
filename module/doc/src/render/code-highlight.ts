import { plugins, highlight as prismHighlight, languages } from 'prismjs';

import 'prismjs/plugins/normalize-whitespace/prism-normalize-whitespace';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-scss';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-properties';
import 'prismjs/components/prism-bash';

plugins.NormalizeWhitespace.setDefaults({
  'remove-trailing': true,
  'remove-indent': true,
  'left-trim': true,
  'right-trim': true
});

const nw = plugins.NormalizeWhitespace;

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
    return prismHighlight(text, languages[lang], lang)
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

