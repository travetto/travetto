import * as fs from 'fs';
import { getParent } from './util';
import * as marked from 'marked';
import * as Prism from 'prismjs';

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

function highlight(text: string, lang: string) {
  text = nw.normalize(text, {
    indent: 0
  });

  text = text
    .replace(/&#(\d+);/g, (x, code) => String.fromCharCode(code))
    .replace(/&([a-z][^;]*);/g, (a, k) => tokenMapping[k] || a);

  try {
    return (Prism.highlight(text, Prism.languages[lang], lang) as string)
      .replace(/(@\s*<span[^>]*)function("\s*>)/g, (a, pre, post) => `${pre}meta${post}`);
  } catch (e) {
    console.error(e.stack);
  }
}


class MyRenderer extends marked.Renderer {
  constructor(options?: marked.MarkedOptions) {
    super(options);
  }
  link(href: string, title: string, text: string) {
    if (title) {
      title = `title="${title}"`;
    }
    if (/^#/.test(href)) {
      return `<a class="anchor-link"
                routerLink="."
                fragment="${href.substring(1)}" ${title}>${text}</a>`;
    } else if (/^http(s)?:\/\/github[.]com\/travetto/.test(href)) {
      const mod = href.split('/module/')[1]
        .replace(/#readme/, '');

      const parent = getParent(mod);
      href = `/docs/${parent}`;

      return `<a class="module-link" routerLink="${href}" ${mod !== parent ? `fragment="${mod}"` : ''} ${title}>${text}</a>`;
    } else if (href.startsWith('http')) {
      return `<a class="external-link" href="${href}" target="_blank" ${title}>${text}</a>`;
    } else if (href.startsWith('.')) {
      href = `https://github.com/travetto/travetto/tree/master/module/%MODULE%/${href.replace(/^.[/]/, '')}`;
      return `<a class="source-link" href="${href}" target="_blank" ${title}>${text}</a>`;
    }
    return super.link(href, title, text);
  }
  codespan(code: string) {
    if (/^█/.test(code)) {
      return `<code class="inline language-typescript">${code.substring(1)}</code>`;
    } else if (/^@[A-Za-z0-9()"'=, ]+$/.test(code)) {
      return `<code class="decorator inline">${code}</code>`;
    } else if (/^([^/]*\/.*[.].*)|([^/]*\/[^/]*\/.*)$/.test(code)) {
      return `<code class="path inline">${code}</code>`;
    } else {
      return `<code class="inline">${code}</code>`;
    }
  }
  strong(text: string) {
    const headerType = /^\s*Terminal\s*:/.test(text) ? 'terminal' :
      /^\s*Install\s*:/.test(text) ? 'install' :
        /^\s*Config\s*:/.test(text) ? 'config' :
          /^\s*Code\s*:/.test(text) ? 'code' : '';

    if (headerType) {
      text = text.replace(/^[^:]+:\s*/, '');
      text = text.charAt(0).toUpperCase() + text.substring(1);
      return `<app-section-header headerType="${headerType}">${text}</app-section-header>`;
    } else {
      return super.strong(text);
    }
  }
  code(text: string, lang: string, escaped?: boolean) {
    let out: string;
    if (lang) {
      if (lang.includes('-inline')) {
        lang = lang.replace(/-inline/g, '');
        out = `<code class="inline language-${lang}">${highlight(text, lang)}</code>`;
      } else {
        out = `<pre><code class="language-${lang}">${highlight(text, lang)}</code></pre>`;
      }
      out = out.replace(/\b[A-Z][a-z]+([A-Z][a-z]*)*\b(?!<\/span)/g, (a) =>
        `<span class="token type">${a}</span>`);
    } else {
      out = super.code(text, lang, !!escaped);
    }
    return out;
  }
}

const opts = {
  gfm: true,
  breaks: true,
  smartypants: true
};

export function render(markdownFile: string): string {
  const content = fs.readFileSync(markdownFile, 'utf8')
    .replace(/Travetto:\s*/gi, '')
    .replace(/```([^\n]*?)```/g, (a, c) => `\`█${c}\``);

  let links = '';

  let output = (marked(content, { ...opts, renderer: new MyRenderer(opts) }) as string)
    .replace(/[{}]/g, a => `{{ '${a}' }}`)
    .replace(/<p>\s*(<app-section-header.*?)<\/p>/g, (a, s) => s)
    .replace(/<h[23][^>]+>(Outline|Overview).*?<\/[uo]l>/ms, (a) => {
      links = a;
      return '';
    });
  output = `<div class="documentation">${output}</div>`;

  if (links) {
    output = `<div class="documentation-links"><div class="inner">${links}</div></div>${output}`;
  }

  return output;
}