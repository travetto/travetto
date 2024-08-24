import { BinaryUtil } from '@travetto/runtime';

export class BytesUtil {

  /**
   * Fetch bytes from a url
   */
  static async fetchBytes(url: string, byteLimit: number = -1): Promise<Buffer> {
    const str = await fetch(url, {
      headers: (byteLimit > 0) ? {
        Range: `0-${byteLimit - 1}`
      } : {}
    });

    if (!str.ok || !str.body) {
      throw new Error('Invalid url for hashing');
    }

    let count = 0;
    const buffer: Buffer[] = [];

    for await (const chunk of str.body) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      buffer.push(buf);
      count += buf.length;

      if (count > byteLimit && byteLimit > 0) {
        break;
      }
    }

    await str.body?.cancel()?.catch(() => { });
    return Buffer.concat(buffer, byteLimit <= 0 ? undefined : byteLimit);
  }

  /**
   * Compute hash from a url
   */
  static async hashUrl(url: string, byteLimit = -1): Promise<string> {
    return BinaryUtil.hashInput(await this.fetchBytes(url, byteLimit));
  }
}