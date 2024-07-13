import util from 'node:util';
import { sep } from 'node:path/win32';

import { ShellCommandImpl } from '../../src/types';

const escape = (text: string): string =>
  text
    .replaceAll('"', '\\"')
    .replaceAll('$', '\\$');

const escapedArgs = (args: string[]): string[] => args.map(x =>
  x.includes(' ') || x.includes('"') ? `'${x}'` : (x.includes("'") ? `"${x}"` : x)
);

const toWin = (file: string): string => file.replace(/[\\\/]+/g, sep);

export const ShellCommands: Record<'win32' | 'posix', ShellCommandImpl> = {
  win32: {
    var: (name: string) => `%${name}%`,
    callCommandWithAllArgs: (cmd, ...args) => [[cmd, ...escapedArgs(args), '%*'].join(' ')],
    createFile: (file, text) => [
      ['@echo', 'off'],
      ...text.map((line, i) =>
        ['echo', `"${escape(line)}"`, i === 0 ? '>' : '>>', file]
      )
    ],
    copy: (src, dest) => ['copy', src, dest],
    copyRecursive: (src, dest, inclusive) =>
      ['xcopy', '/y', '/h', '/s', inclusive ? `${toWin(src)}\\*.*` : toWin(src), toWin(dest)],
    rmRecursive: (dest) => ['rmdir', '/Q', '/S', dest],
    mkdir: (dest) => ['md', dest],
    export: (key, value) => ['set', `${key}=${value}`],
    chdir: (dest) => ['cd', dest],
    comment: (message) => ['\nREM', util.stripVTControlCharacters(message), '\n'],
    echo: (message) => ['echo', `"${escape(util.stripVTControlCharacters(message))}"\n`],
    zip: (outputFile) => ['powershell', 'Compress-Archive', '-Path', '.', '-DestinationPath', outputFile],
    script: (lines: string[], changeDir: boolean = false) => ({
      ext: '.cmd',
      contents: [
        ...(changeDir ? ['cd %~p0'] : []),
        ...lines,
      ]
    })
  },
  posix: {
    var: (name: string) => `$${name}`,
    callCommandWithAllArgs: (cmd, ...args) => [[cmd, ...escapedArgs(args), '$@'].join(' ')],
    createFile: (file, text, mode) => [
      ...text.map((line, i) =>
        ['echo', `"${escape(line)}"`, i === 0 ? '>' : '>>', file]),
      ...(mode ? [['chmod', mode, file]] : [])
    ],
    copy: (src, dest) => ['cp', src, dest],
    copyRecursive: (src, dest, inclusive) =>
      ['cp', '-r', '-p', inclusive ? `${src}/*` : src, dest],
    rmRecursive: (dest) => ['rm', '-rf', dest],
    mkdir: (dest) => ['mkdir', '-p', dest],
    export: (key, value) => ['export', `${key}=${value}`],
    chdir: (dest) => ['cd', dest],
    comment: (message) => ['\n#', util.stripVTControlCharacters(message), '\n'],
    echo: (message) => ['echo', `"${escape(util.stripVTControlCharacters(message))}"\n`],
    zip: (outputFile) => ['zip', '-r', outputFile, '.'],
    script: (lines: string[], changeDir: boolean = false) => ({
      ext: '.sh',
      contents: [
        '#!/bin/sh',
        ...(changeDir ? ['cd $(dirname "$0")'] : []),
        ...lines,
      ]
    })
  },
};

export const ActiveShellCommand = ShellCommands[process.platform === 'win32' ? 'win32' : 'posix'];