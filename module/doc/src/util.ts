import * as fs from 'fs';
import '@travetto/registry';
import { ExecUtil, FsUtil } from '@travetto/boot';

const PACKAGES = new Map(
  fs.readdirSync(FsUtil.resolveUnix(__dirname, '..', '..'))
    .filter(x => !x.startsWith('.'))
    .map(x => [x, require(`../../${x}/package.json`) as Record<string, any>])
);

export function Block(title: string, text: string, language: string) {
  return `
**${title}**
\`\`\`${language}
${text}
\`\`\``;
}

export function Run(cmd: string, ...args: string[]) {
  if (cmd === 'travetto') {
    cmd = `npx`;
    args.unshift('travetto');
  }

  process.env.TRV_DEBUG = '0';
  // eslint-disable-next-line no-control-regex
  return ExecUtil.execSync(cmd, args).replace(/\x1b\[\d+[a-z]/g, '');
}

export function Read(file: string) {
  return fs.readFileSync(FsUtil.resolveUnix(FsUtil.cwd, file), 'utf8')
    .replace(/^\/\/\s*@file-if.*/, '');
}

export function Mod(name: string) {
  if (!(PACKAGES.has(name))) {
    throw new Error(`Module ${name} is unknown`);
  }
  const config = PACKAGES.get(name)!;
  return `[${config.title}](../${name} "${config.description}")`;
}

export function Ref(fn: Function) {
  return `[${fn.name}](${fn.ᚕfile})`;
}

export function Method(name: string) {
  return `\`${name}\``;
}

export function Code(title: string, cmd: string, language = 'typescript') {
  if (/^[:A-Za-z0-9\/\\\-_.]+[.]ts$/.test(cmd)) {
    cmd = Read(cmd);
  }
  return Block(`Code: ${title}`, cmd, language);
}

export function Snippet(title: string, file: string, startPattern: RegExp, endPattern: RegExp, language = 'typescript') {
  const content = Read(file).split(/\n/g);
  const startIdx = content.findIndex(l => startPattern.test(l));
  const endIdx = content.findIndex((l, i) => i > startIdx && endPattern.test(l));
  return Code(`${title}`, content.slice(startIdx, endIdx + 1).join('\n'), language);
}

export function SnippetLink(title: string, file: string, startPattern: RegExp) {
  const content = Read(file).split(/\n/);
  const startIdx = content.findIndex(l => startPattern.test(l));
  return `[${title}](${file}#L${startIdx})`;
}

export function Command(script: string, ...args: string[]) {
  return `\`${[script, ...args].join(' ')}\``;
}

export function Terminal(title: string, script: string, ...args: string[]) {
  if (!script.includes('\n')) {
    script = Run(script, ...args);
  }
  return Block(`Terminal: ${title}`, script, 'bash');
}

export function Input(text: string) {
  return `\`${text}\``;
}

export function Section(title: string) {
  return [`## ${title}\n`, ''].join('\n');
}

export function SubSection(title: string) {
  return [`### ${title}\n`, ''].join('\n');
}

export function Install(pkg: string, title = pkg) {
  return Block(`Install: ${title}`, `npm install ${pkg}`, 'bash');
}


export function docs(values: TemplateStringsArray, ...keys: (Function | string)[]) {
  const out = keys.map((el, i) => {
    if (typeof el !== 'string') {
      el = Ref(el);
    }
    return `${values[i] ?? ''}${el ?? ''}`;
  });
  if (values.length > keys.length) {
    out.push(values[values.length - 1]);
  }

  const root = new Error().stack!
    .split('\n')
    .find(x => /README[.]ts/.test(x))!
    .match(/([A-Za-z0-9\-\/\\]+)[\/\\]README[.]ts/)![1];

  const pkg = require(`${root}/package.json`);

  out.unshift(`# travetto: ${pkg.title}\n`, `## ${pkg.description}\n`, '\n', Install(pkg.name), '\n');

  const text = out.join('');
  console.log(text);
  return text;
}