#!/usr/bin/env ts-node

// tslint:disable:no-non-null-assertion

import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import { render } from './process-markdown';
import { MAPPING, Mapping } from './mapping';
import { getParent } from './util';

const SELF = __dirname;
const GHP_ROOT = path.dirname(SELF);
const RELATED_ROOT = path.dirname(GHP_ROOT);
const MOD_ROOT = fs.realpathSync(process.argv[2]);
const DOC_ROOT = `${GHP_ROOT}/src/app/documentation`;

interface Page {
  path: string;
  title: string;
  component?: string;
  subs?: Page[];
}

const readLines = (f: string) => fs.readFileSync(f).toString().split('\n');

function writeContents(f: string, contents: string) {
  const existing = fs.existsSync(f) ? fs.readFileSync(f).toString() : undefined;

  if (existing !== contents) {
    console.log('Updating', f);
    fs.writeFileSync(f, contents);
  }
}

function markdowns(root: string) {
  return cp.execSync(`find ${root} -name '*.md' | grep -v node_modules`).toString().split('\n').filter(x => !!x);
}

function compileModule(root: string, moduleConf: Mapping, sub?: string) {
  const mod = moduleConf.module;

  if (sub) {
    root = `${root}/${sub}`;
  }

  if (!(fs.existsSync(`${root}/${mod}`) || fs.existsSync(`${MOD_ROOT}/${mod}`))) {
    return;
  }

  const html = `${root}/${mod}/${mod}.component.html`;
  let markdown = `${MOD_ROOT}/${mod}/README.md`;

  if (fs.existsSync(markdown)) {
    if (!fs.existsSync(html)) {
      cp.execSync(`ng g c documentation/${sub}/${mod}`, { cwd: GHP_ROOT });
    }
  } else {
    markdown = `${root}/${mod}/${mod}.component.md`;
  }

  console.log(`Marking Down ${mod}`);
  let content = render(markdown).replace(/%MODULE%/g, mod).replace('<h1', `<h1 id="${mod}"`);

  const componentTag = moduleConf.tag || readLines(`${root}/${mod}/${mod}.component.ts`)
    .find(x => /selector\s*:/.test(x))!
    .split(/selector\s*:\s* /)[1]
    .replace(/[^A-Za-z0-9\-]+/g, '')
    .trim();

  const componentName = moduleConf.component || (readLines(`${root}/${mod}/${mod}.component.ts`)
    .find(x => /\bclass\b/.test(x))!
    .split(/class\s*/)[1]
    .split(/[^A-Za-z0-9_\-]+/)
    .find(x => !!x));

  const componentTitle = moduleConf.title || content.split('\n')
    .find(x => x.includes('<h1'))!
    .split(/<h1[^>]*>/)[1]
    .split('<')[0];

  const par = getParent(mod);

  if (par && par !== mod) {
    content = content.replace(/(<[\/]?h)(\d)/g, (a, t, n) => `${t}${parseInt(n, 10) + 1}`);
  }

  content = content.replace(/(<img[^>]+src=")([^"]+)("[^>]*>)/g, (all, l, href, r) => {
    if (!/^(http|https|\/)/.test(href)) {
      href = href.substring(href.indexOf('/') + 1) || href;
      href = `/assets/${mod}/${href}`;
    }
    return `${l}${href}${r}`;
  });

  const ret = {
    componentName,
    componentTitle,
    componentTag,
    list: moduleConf.list === undefined || moduleConf.list,
    imports: [`import { ${componentName} } from '.${sub ? `/${sub}` : ''}/${mod}/${mod}.component';`],
    page: { path: mod, title: componentTitle, component: componentName, subs: [] } as Page
  };

  let subContent = '';

  for (const child of (moduleConf.children || [])) {
    let childRes = compileModule(DOC_ROOT, child, 'gen');
    if (!childRes) {
      childRes = compileModule(DOC_ROOT, child);
    }
    // ret.imports.push(...childRes.imports);
    ret.page.subs!.push({
      path: child.module,
      title: childRes!.componentTitle.replace(`${componentTitle}-`, '')
    });
    subContent = `${subContent}
      <${childRes!.componentTag}></${childRes!.componentTag}>
`;
  }

  if (subContent) {
    if (content.includes('<!-- SUB -->')) {
      content = content.replace(/<!-- SUB -->/g, subContent);
    } else {
      content = `${content}\n${subContent}`;
    }
  }

  writeContents(html, content);

  return ret;
}

function renderDocs() {
  const state = {
    imports: [] as string[],
    pages: [] as Page[]
  };

  for (const moduleConf of MAPPING) {
    let res = compileModule(DOC_ROOT, moduleConf, 'gen');
    if (!res) {
      res = compileModule(DOC_ROOT, moduleConf);
    }
    if (!res) {
      continue;
    }
    if (res.list) {
      state.imports.push(...res.imports);
      state.pages.push(res.page);
    }
  }

  // Update component listing
  function renderPages(pages: typeof state.pages) {
    return `[\n${pages
      .map(x => {
        let out = `  { path: '${x.path}', title: '${x.title}'`;
        if (x.component) {
          out = `${out}, component: ${x.component}`;
        }
        if (x.subs) {
          out = `${out}, subs: ${renderPages(x.subs)}`;
        }
        out = `${out} }`;
        return out;
      })
      .join(',\n')}\n]`;
  }

  writeContents(`${DOC_ROOT}/pages.ts`, `
${state.imports.join('\n')}

export const PAGES = ${renderPages(state.pages)};
`);
}

function renderGuide() {
  compileModule(`${GHP_ROOT}/src/app`, { module: 'guide' });
}

function waitForChange() {
  const files = [...markdowns(`${GHP_ROOT}/src`), ...markdowns(MOD_ROOT)];
  cp.execSync(`inotifywait -e attrib,modify,move,create,delete ${files.join(' ')}`);
}
cp.execSync(`ln -sf ${RELATED_ROOT}/vscode-plugin/images ${GHP_ROOT}/src/assets/vscode-plugin`);
cp.execSync(`ln -sf ${RELATED_ROOT}/vscode-plugin/README.md ${DOC_ROOT}/vscode-plugin/vscode-plugin.component.md`);
cp.execSync(`ln -sf ${path.dirname(MOD_ROOT)}/sample/todo-app/README.md ${GHP_ROOT}/src/app/guide/guide.component.md`);
cp.execSync(`ln -sf ${path.dirname(MOD_ROOT)}/README.md ${DOC_ROOT}/overview/overview.component.md`);

if (process.argv[3] === 'watch') {
  while (true) {
    renderDocs();
    renderGuide();
    waitForChange();
  }
} else {
  renderDocs();
  renderGuide();
}
