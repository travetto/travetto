import * as fs from 'fs';
import '@travetto/registry';
import { ExecUtil, FsUtil } from '@travetto/boot';

export function block(title: string, text: string, language: string) {
  return `
**${title}**
\`\`\`${language}
${text}
\`\`\``;
}

export function run(cmd: string, ...args: string[]) {
  if (cmd === 'travetto') {
    cmd = `npx`;
    args.unshift('travetto');
  }
  process.env.TRV_DEBUG = '0';
  // eslint-disable-next-line no-control-regex
  return ExecUtil.execSync(cmd, args).replace(/\x1b\[\d+[a-z]/g, '');
}

export function read(file: string) {
  return fs.readFileSync(FsUtil.resolveUnix(FsUtil.cwd, file), 'utf8');
}

export function mod(name: string) {
  return `[${name}](../${name})`;
}

export function decorator(fn: Function) {
  return `[${fn.name}](${fn.ᚕfile})`;
}

export function method(name: string) {
  return `\`${name}\``;
}

export function code(title: string, cmd: string, language = 'typescript') {
  return block(`Code: ${title}`, cmd, language);
}

export function command(script: string, ...args: string[]) {
  return `\`${[script, ...args].join(' ')}\``;
}

export function terminal(title: string, script: string) {
  return block(`Terminal: ${title}`, script, 'bash');
}

export function input(text: string) {
  return `\`${text}\``;
}


export function Docs(root: string, title: string) {
  const pkg = require(`${root}/package.json`);
  return (...args: string[]) => {
    console!.log([
      `
travetto: ${title}
===
`,
      block(`Install: ${pkg.name}`, `npm install ${pkg.name}`, 'bash'),
      '',
      ...args
    ].join('\n'));
  };
}