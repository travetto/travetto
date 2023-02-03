import { ShellCommandImpl } from './types';

export const ShellCommands: Record<'win32' | 'posix', ShellCommandImpl> = {
  win32: {
    scriptOpen: () => [],
    callCommandWithAllArgs: (cmd, ...args) => [cmd, ...args, '%*'],
    createScript: (file, text, mode) => [['@echo', 'off'], ['echo', `"${text.replaceAll('\n', '\\n')}"`, '>', file]],
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
    scriptOpen: () => ['#!/bin/sh'],
    callCommandWithAllArgs: (cmd, ...args) => [cmd, ...args, '$@'],
    createScript: (file, text, mode) => [['echo', `"${text.replaceAll('\n', '\\n')}"`, '>', file], ['chmod', mode, file]],
    copy: (src, dest) => ['cp', src, dest],
    copyRecursive: (src, dest) => ['cp', '-r', '-p', src, dest],
    rmRecursive: (dest) => ['rm', '-rf', dest],
    mkdir: (dest) => ['mkdir', dest],
    export: (key, value) => ['export', `${key}=${value}`],
    chdir: (dest) => ['cd', dest],
    comment: (message) => ['\n#', message, '\n'],
    zip: (outputFile) => ['zip', '-r', outputFile, '.']
  },
};

export const ActiveShellCommand = ShellCommands[process.platform === 'win32' ? 'win32' : 'posix'];