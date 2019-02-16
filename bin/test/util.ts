export class Util {
  static deserializeError(e: Error | { message: string, stack: any, name: string }) {
    if (e && ('$' in (e as any))) {
      const err = new Error();
      for (const k of Object.keys(e)) {
        (err as any)[k] = (e as any)[k];
      }
      err.message = e.message;
      err.stack = e.stack;
      err.name = e.name;
      return err;
    } else if (e) {
      return e;
    }
  }
}