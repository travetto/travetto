import { Class } from '@travetto/registry';
import { PendingRegister } from '@travetto/registry/src/decorator';

/**
 * Common utils for manipulating the test registry, used in rare occasions
 */
export class TestRegistryUtil {
  /**
   * Declare a new test class given a src and an extension point.  Useful for
   * dynamically generating test suites based on specific patterns
   */
  static customizeClass(src: Class, ext: Class, suffix?: string) {
    const coreName = suffix ? ext.name.replace(new RegExp(`${suffix}$`), '') : ext.name;
    const name = `${src.name}${coreName}`;

    const Custom = class extends src { };
    Object.defineProperty(Custom, 'name', { value: name });
    Object.defineProperty(Custom, 'shortName', { value: coreName });

    PendingRegister.initMeta(Custom, src.__file, src.__hash, { ...src.__methods }, false);

    return Custom as Class & { shortName: string };
  }
}