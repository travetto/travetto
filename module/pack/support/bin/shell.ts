import { path } from '@travetto/manifest';

import { ShellCommandImpl } from './types';

export const ShellCommands: Record<'win32' | 'posix', ShellCommandImpl> = {
  win32: {
    var: (name: string) => `%${name}%`,
    scriptOpen: () => [],
    callCommandWithAllArgs: (cmd, ...args) => [cmd, ...args, '%*'],
    createScript: (file, text) => [
      ['@echo', 'off'],
      ...text.map((line, i) =>
        ['echo', `"${line.replaceAll('"', '\\"')}"`, i === 0 ? '>' : '>>', file]
      )
    ],
    copy: (src, dest) => ['copy', src, dest],
    copyRecursive: (src, dest) => ['xcopy', '/y', '/h', '/s', path.toNative(src), path.toNative(dest)],
    rmRecursive: (dest) => ['rmdir', '/Q', '/S', dest],
    mkdir: (dest) => ['md', dest],
    export: (key, value) => ['set', `${key}=${value}`],
    chdir: (dest) => ['cd', dest],
    comment: (message) => ['\nREM', message, '\n'],
    zip: (outputFile) => ['powershell', 'Compress-Archive', '-Path', '.', '-DestinationPath', outputFile]
  },
  posix: {
    var: (name: string) => `$${name}`,
    scriptOpen: () => ['#!/bin/sh'],
    callCommandWithAllArgs: (cmd, ...args) => [cmd, ...args, '$@'],
    createScript: (file, text, mode) => [
      ...text.map((line, i) =>
        ['echo', `"${line.replaceAll('"', '\\"')}"`, i === 0 ? '>' : '>>', file]),
      ...(mode ? [['chmod', mode, file]] : [])
    ],
    copy: (src, dest) => ['cp', src, dest],
    copyRecursive: (src, dest) => ['cp', '-r', '-p', src, dest],
    rmRecursive: (dest) => ['rm', '-rf', dest],
    mkdir: (dest) => ['mkdir', '-p', dest],
    export: (key, value) => ['export', `${key}=${value}`],
    chdir: (dest) => ['cd', dest],
    comment: (message) => ['\n#', message, '\n'],
    zip: (outputFile) => ['zip', '-r', outputFile, '.']
  },
};

export const ActiveShellCommand = ShellCommands[process.platform === 'win32' ? 'win32' : 'posix'];