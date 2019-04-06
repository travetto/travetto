import * as child_process from 'child_process';

export function launch(path: string) {
  const op = process.platform === 'darwin' ? 'open' :
    process.platform === 'win32' ? 'cmd /c start' :
      'xdg-open';

  child_process.exec(`${op} ${path}`);
}