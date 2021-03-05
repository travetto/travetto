export class RenderUtil {
  static TOKENS: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '{': "{{'{'}}", '}': "{{'}'}}" };

  static titleCase(a: string) {
    return `${a.charAt(0).toUpperCase()}${a.substr(1)}`;
  }

  static clean(a?: string) {
    return a ? a.replace(/^[\n ]+|[\n ]+$/gs, '') : '';
  }

  static getId(a: string) {
    return a.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/ /g, '-');
  }
}