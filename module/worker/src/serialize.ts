import { AppError, hasToJSON } from '@travetto/runtime';

export class SerializeUtil {

  /**
   * Serialize to JSON
   */
  static serializeToJSON<T>(out: T): string {
    return JSON.stringify(out, function (k, v) {
      const ov = this[k];
      if (ov && ov instanceof Error) {
        return {
          $: true,
          ...hasToJSON(ov) ? ov.toJSON() : ov,
          name: ov.name,
          message: ov.message,
          stack: ov.stack?.replace(/.*\[ERR_ASSERTION\]:\s*/, ''),
        }
      } else if (typeof v === 'bigint') {
        return v.toString();
      } else {
        return v;
      }
    });
  }

  /**
   * Deserialize from JSON
   */
  static deserializeFromJson<T = unknown>(input: string): T {
    return JSON.parse(input, function (k, v) {
      if (v && typeof v === 'object' && '$' in v) {
        const err = AppError.fromJSON(v) ?? new Error();
        if (!(err instanceof AppError)) {
          const { $: _, ...rest } = v;
          Object.assign(err, rest);
        }
        err.message = v.message;
        err.stack = v.stack;
        err.name = v.name;
        return err;
      } else if (typeof v === 'string' && /^\d+n$/.test(v)) {
        return BigInt(v);
      } else {
        return v;
      }
    });
  }

  /**
   * Handle event on receipt
   */
  static afterReceive<T>(ev: T): T {
    return this.deserializeFromJson<T>(JSON.stringify(ev));
  }

  /**
   * Prepare event for sending
   */
  static beforeSend<T>(ev: T): T {
    return JSON.parse(this.serializeToJSON(ev));
  }
}