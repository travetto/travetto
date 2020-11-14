export class ModelExpiryUtil {
  static getExpiresAt(ttl: number): Date {
    if (ttl < 1000000) {
      ttl = Date.now() + ttl;
    }
    return new Date(ttl);
  }
}