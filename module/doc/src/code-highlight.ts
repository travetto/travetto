const Prism = require('prismjs');

require('prismjs/plugins/normalize-whitespace/prism-normalize-whitespace');
require('prismjs/components/prism-typescript');
require('prismjs/components/prism-javascript');
require('prismjs/components/prism-css');
require('prismjs/components/prism-scss');
require('prismjs/components/prism-yaml');
require('prismjs/components/prism-json');
require('prismjs/components/prism-sql');
require('prismjs/components/prism-properties');
require('prismjs/components/prism-bash');

Prism.plugins.NormalizeWhitespace.setDefaults({
  'remove-trailing': true,
  'remove-indent': true,
  'left-trim': true,
  'right-trim': true
});

const nw = Prism.plugins.NormalizeWhitespace;

const tokenMapping: { [key: string]: string } = {
  gt: '>',
  lt: '<',
  quot: '"',
  apos: `'`
};

export function highlight(text: string, lang: string) {
  text = nw.normalize(text, {
    indent: 0
  });

  text = text
    .replace(/&#(\d+);/g, (x, code) => String.fromCharCode(code))
    .replace(/&([a-z][^;]*);/g, (a, k) => tokenMapping[k] || a);

  try {
    return (Prism.highlight(text, Prism.languages[lang], lang) as string)
      .replace(/(@\s*<span[^>]*)function("\s*>)/g, (a, pre, post) => `${pre}meta${post}`)
      .replace(/[{}]/g, a => `{{'${a}'}}`);
  } catch (e) {
    console.error(e.message as string, { error: e });
  }
}

