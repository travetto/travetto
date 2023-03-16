import { path } from '@travetto/manifest';
import { stripAnsiCodes } from '@travetto/terminal';

import { ShellCommandImpl } from './types';

const escape = (text: string): string =>
  text
    .replaceAll('"', '\\"')
    .replaceAll('$', '\\$');

export const ShellCommands: Record<'win32' | 'posix', ShellCommandImpl> = {
  win32: {
    var: (name: string) => `%${name}%`,
    scriptOpen: () => [],
    chdirScript: () => ['cd', '%~p0'],
    callCommandWithAllArgs: (cmd, ...args) => [cmd, ...args, '%*'],
    createFile: (file, text) => [
      ['@echo', 'off'],
      ...text.map((line, i) =>
        ['echo', `"${escape(line)}"`, i === 0 ? '>' : '>>', file]
      )
    ],
    copy: (src, dest) => ['copy', src, dest],
    copyRecursive: (src, dest) => ['xcopy', '/y', '/h', '/s', path.toNative(src), path.toNative(dest)],
    rmRecursive: (dest) => ['rmdir', '/Q', '/S', dest],
    mkdir: (dest) => ['md', dest],
    export: (key, value) => ['set', `${key}=${value}`],
    chdir: (dest) => ['cd', dest],
    comment: (message) => ['\nREM', stripAnsiCodes(message), '\n'],
    echo: (message) => ['echo', `"${escape(stripAnsiCodes(message))}"\n`],
    zip: (outputFile) => ['powershell', 'Compress-Archive', '-Path', '.', '-DestinationPath', outputFile]
  },
  posix: {
    var: (name: string) => `$${name}`,
    scriptOpen: () => ['#!/bin/sh'],
    chdirScript: () => ['cd', '$(dirname "$0")'],
    callCommandWithAllArgs: (cmd, ...args) => [cmd, ...args, '$@'],
    createFile: (file, text, mode) => [
      ...text.map((line, i) =>
        ['echo', `"${escape(line)}"`, i === 0 ? '>' : '>>', file]),
      ...(mode ? [['chmod', mode, file]] : [])
    ],
    copy: (src, dest) => ['cp', src, dest],
    copyRecursive: (src, dest) => ['cp', '-r', '-p', src, dest],
    rmRecursive: (dest) => ['rm', '-rf', dest],
    mkdir: (dest) => ['mkdir', '-p', dest],
    export: (key, value) => ['export', `${key}=${value}`],
    chdir: (dest) => ['cd', dest],
    comment: (message) => ['\n#', stripAnsiCodes(message), '\n'],
    echo: (message) => ['echo', `"${escape(stripAnsiCodes(message))}"\n`],
    zip: (outputFile) => ['zip', '-r', outputFile, '.']
  },
};

export const ActiveShellCommand = ShellCommands[process.platform === 'win32' ? 'win32' : 'posix'];