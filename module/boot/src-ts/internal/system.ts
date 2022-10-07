import * as cp from 'child_process';

/**
 * Shared util
 */
export class SystemUtil {
  /**
   * Naive hashing
   */
  static naiveHash(text: string): number {
    let hash = 5381;

    for (let i = 0; i < text.length; i++) {
      // eslint-disable-next-line no-bitwise
      hash = (hash * 33) ^ text.charCodeAt(i);
    }

    return Math.abs(hash);
  }

  /**
   * OS aware file opening
   */
  static nativeOpen(pth: string): void {
    const op = process.platform === 'darwin' ? ['open', pth] :
      process.platform === 'win32' ? ['cmd', '/c', 'start', pth] :
        ['xdg-open', pth];

    cp.spawnSync(op.join(' '));
  }
}