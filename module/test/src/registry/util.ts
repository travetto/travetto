import { Class } from '@travetto/registry';

export class TestRegistryUtil {
  static customizeClass(src: Class, ext: Class, suffix?: string) {
    const coreName = suffix ? ext.name.replace(new RegExp(`${suffix}$`), '') : ext.name;
    const name = `${coreName}${src.name}`;
    const Custom = class extends src { };
    Custom.__filename = src.__filename;
    Custom.__id = src.__id.replace(/#/, `#${coreName}`);
    Custom.__methods = { ...src.__methods };
    Custom.__abstract = false;
    Object.defineProperty(Custom, 'name', { value: name });
    Object.defineProperty(Custom, 'shortName', { value: coreName });
    return Custom as Class & { shortName: string };
  }
}