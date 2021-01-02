/**
 * Utils for model expiry
 */
export class ModelExpiryUtil {
  /**
   * Determines if a ttl is a date or a ms offset
   * @param ttl
   */
  static getExpiresAt(ttl: number): Date {
    if (ttl < 1000000) {
      ttl = Date.now() + ttl;
    }
    return new Date(ttl);
  }
}