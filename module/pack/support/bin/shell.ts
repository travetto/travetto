import util from 'node:util';
import path from 'node:path';

import { ShellCommandProvider } from '../../src/types.ts';

const escape = (text: string): string =>
  text
    .replaceAll('"', '\\"')
    .replaceAll('$', '\\$');

const escapedArgs = (args: string[]): string[] => args.map(arg =>
  arg.includes(' ') || arg.includes('"') ? `'${arg}'` : (arg.includes("'") ? `"${arg}"` : arg)
);

const toWin = (file: string): string => file.replace(/[\\\/]+/g, path.win32.sep);

export const ShellCommands: Record<'win32' | 'posix', ShellCommandProvider> = {
  win32: {
    var: (name: string) => `%${name}%`,
    callCommandWithAllArgs: (cmd, ...args) => [[cmd, ...escapedArgs(args), '%*'].join(' ')],
    createFile: (file, text) => [
      ['@echo', 'off'],
      ...text.map((line, i) =>
        ['echo', `"${escape(line)}"`, i === 0 ? '>' : '>>', file]
      )
    ],
    copy: (sourceFile, destinationFile) => ['copy', sourceFile, destinationFile],
    copyRecursive: (sourceDirectory, destinationDirectory, inclusive) =>
      ['xcopy', '/y', '/h', '/s', inclusive ? `${toWin(sourceDirectory)}\\*.*` : toWin(sourceDirectory), toWin(destinationDirectory)],
    rmRecursive: (destinationDirectory) => ['rmdir', '/Q', '/S', destinationDirectory],
    mkdir: (destinationDirectory) => ['md', destinationDirectory],
    export: (key, value) => ['set', `${key}=${value}`],
    chdir: (destinationDirectory) => ['cd', destinationDirectory],
    comment: (message) => ['\nREM', util.stripVTControlCharacters(message), '\n'],
    echo: (message) => ['echo', `"${escape(util.stripVTControlCharacters(message))}"\n`],
    zip: (outputFile) => ['powershell', 'Compress-Archive', '-Path', '.', '-DestinationPath', outputFile],
    script: (lines: string[], changeDirectory: boolean = false) => ({
      ext: '.cmd',
      contents: [
        ...(changeDirectory ? ['cd %~p0'] : []),
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
    copy: (sourceFile, destinationFile) => ['cp', sourceFile, destinationFile],
    copyRecursive: (sourceDirectory, destinationDirectory, inclusive) =>
      ['cp', '-r', '-p', inclusive ? `${sourceDirectory}/*` : sourceDirectory, destinationDirectory],
    rmRecursive: (destinationDirectory) => ['rm', '-rf', destinationDirectory],
    mkdir: (destinationDirectory) => ['mkdir', '-p', destinationDirectory],
    export: (key, value) => ['export', `${key}=${value}`],
    chdir: (destinationDirectory) => ['cd', destinationDirectory],
    comment: (message) => ['\n#', util.stripVTControlCharacters(message), '\n'],
    echo: (message) => ['echo', `"${escape(util.stripVTControlCharacters(message))}"\n`],
    zip: (outputFile) => ['zip', '-r', outputFile, '.'],
    script: (lines: string[], changeDirectory: boolean = false) => ({
      ext: '.sh',
      contents: [
        '#!/bin/sh',
        ...(changeDirectory ? ['cd $(dirname "$0")'] : []),
        ...lines,
      ]
    })
  },
};

export const ActiveShellCommand = ShellCommands[process.platform === 'win32' ? 'win32' : 'posix'];