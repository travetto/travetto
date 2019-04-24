import { Env } from './env';

export class Stacktrace {

  static filter = (line: string) => !/[\/]@travetto[\/](base|compile|registry|exec|worker|context)/.test(line);

  static simplifyStack(err: Error, filter = true): string {
    const body = err.stack!.replace(/\\/g, '/').split('\n')
      .filter(x => !filter || this.filter(x)) // Exclude framework boilerplate
      .map(x => x
        .replace(`${Env.cwd}/`, '')
        .replace(/^[\/]+/, '')
        .replace(/\bjs\b/g, (a, f) => `ts`)
      );

    if (!filter || body.length > 2) {
      return body.join('  \n');
    } else {
      return this.simplifyStack(err, false);
    }
  }
}