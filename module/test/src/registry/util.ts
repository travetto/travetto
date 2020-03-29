import { Class } from '@travetto/registry';
import { PendingRegister } from '@travetto/registry/src/decorator';

export class TestRegistryUtil {
  static customizeClass(src: Class, ext: Class, suffix?: string) {
    const coreName = suffix ? ext.name.replace(new RegExp(`${suffix}$`), '') : ext.name;
    const name = `${coreName}${src.name}`;
    const Custom = class extends src { };
    PendingRegister.initMeta(Custom, src.__file, src.__hash, { ...src.__methods }, false);
    Custom.__id = src.__id.replace(/#/, `#${coreName}`);
    Object.defineProperty(Custom, 'name', { value: name });
    Object.defineProperty(Custom, 'shortName', { value: coreName });
    return Custom as Class & { shortName: string };
  }
}