export class Util {
  static deserializeError(e: Error | { $?: any, message: string, stack: any, name: string }) {
    if (e && ('$' in e)) {
      const err = new Error();
      for (const k of Object.keys(e) as (keyof typeof err)[]) {
        err[k] = e[k];
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