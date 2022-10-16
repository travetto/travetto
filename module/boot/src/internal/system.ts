import * as crypto from 'crypto';
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
   * Generate a random UUID
   * @param len The length of the uuid to generate
   */
  static uuid(len: number = 32): string {
    const bytes = crypto.randomBytes(Math.ceil(len / 2));
    // eslint-disable-next-line no-bitwise
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    // eslint-disable-next-line no-bitwise
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return bytes.toString('hex').substring(0, len);
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