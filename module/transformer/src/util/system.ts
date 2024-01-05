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

  static naiveHashString(text: string, length: number): string {
    return this.naiveHash(text).toString().padStart(length, '0').substring(0, length);
  }
}