import { default as prismJs } from 'prismjs';

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

prismJs.plugins.NormalizeWhitespace.setDefaults({
  'remove-trailing': true,
  'remove-indent': true,
  'left-trim': true,
  'right-trim': true
});

const nw = prismJs.plugins.NormalizeWhitespace;

const tokenMapping: { [key: string]: string } = {
  '&gt;': '>',
  '&lt;': '<',
  '&quot;': '"',
  '&apos;': "'"
};

export function highlight(text: string, lang: string): string | undefined {
  text = nw.normalize(text, {
    indent: 0
  });

  text = text
    .replace(/&#(\d+);/g, (x, code) => String.fromCharCode(code))
    .replace(/&[a-z][^;]*;/g, a => tokenMapping[a] || a);

  try {
    return prismJs.highlight(text, prismJs.languages[lang], lang)
      .replace(/(@\s*<span[^>]*)function("\s*>)/g, (a, pre, post) => `${pre}meta${post}`)
      .replace(/[{}]/g, a => `{{'${a}'}}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message, { error });
    } else {
      throw error;
    }
  }
}

