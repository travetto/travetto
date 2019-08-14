import { Class } from '@travetto/registry';

export class TestRegistryUtil {
  static customizeClass(src: Class, ext: Class, suffix?: string) {
    const coreName = suffix ? ext.name.replace(new RegExp(`${suffix}$`), '') : ext.name;
    const name = `${coreName}${src.name}`;
    const custom = class extends src { };
    custom.__filename = src.__filename;
    custom.__id = src.__id.replace(/#/, `#${coreName}`);
    custom.__methods = { ...src.__methods };
    custom.__abstract = false;
    Object.defineProperty(custom, 'name', { value: name });
    Object.defineProperty(custom, 'shortName', { value: coreName });
    return custom as Class & { shortName: string };
  }
}