type Class<T = any> = abstract new (...args: any[]) => T;

/**
 * Denotes a class is dynamic
 */
export function Dynamic(key: string): ClassDecorator {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return ((target: Class<unknown>) => {
    if (/^(yes|on|1|true)$/i.test(process.env.TRV_DYNAMIC ?? '')) {
      // Decorate
      const ret = require(key).setup(target);
      Object.defineProperty(ret, 'name', { value: target.name });
      return ret;
    }
  }) as ClassDecorator;
}