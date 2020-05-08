import { ResourceManager } from '@travetto/base';

/**
 * Utils for dealing with file resolution
 */
export class FileUtil {
  /**
   * Wrap HTML tpl with the wrapper
   */
  static async wrapWithBody(tpl: string) {
    return (await ResourceManager.read('email/wrapper', 'utf8')).replace('<!-- BODY -->', tpl);
  }

  /**
   * Resolve nested templates
   */
  static async resolveNestedTemplates(template: string): Promise<string> {
    const promises: Promise<string>[] = [];
    let i = 0;
    template = template.replace(/[{]{2}>\s+(\S+)\s*[}]{2}/g, (all: string, name: string): any => {
      promises.push(
        ResourceManager.read(name, 'utf8')
          .then(contents => this.resolveNestedTemplates(contents))
      );
      return `$%${i++}%$`;
    });
    const resolved = await Promise.all(promises);
    return template.replace(/$%(\d+)%$/g, (__, idx) => resolved[+idx]);
  }
}