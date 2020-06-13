import { Node } from 'parse5';
import { Parse5Adapter } from './html';

/**
 * Component factory for rendering an html node or a string
 */
export interface ComponentFactory {
  render(document: Node): Node;
  render(document: string): string;
}

/**
 * Registry for tagging components
 */
export class TagRegistry {
  private static data: Map<any, Record<string, (node: Node) => string>> = new Map();

  static id(cls: any) {
    return cls && cls.constructor !== Function ? cls.constructor : cls;
  }

  static getTag(tag: string | Node, ns: string) {
    return (typeof tag === 'string' ? tag : Parse5Adapter.getTagName(tag)).replace(new RegExp(`^${ns}`), '');
  }

  static register(cls: any, name: string, fn: (node: Node) => string) {
    cls = this.id(cls);
    if (!this.data.has(cls)) {
      this.data.set(cls, {});
    }
    this.data.get(cls)![name] = fn;
  }

  static resolve(cls: any, tag: string) {
    cls = this.id(cls);
    return this.data.get(cls)?.[tag] ?? '';
  }

  static has(cls: any, tag: string) {
    cls = this.id(cls);
    return !!this.data.get(cls)?.[tag];
  }
}

/**
 * Tag Decorator
 */
export function Tag(name?: string) {
  return (
    target: any, prop: string | symbol, desc: TypedPropertyDescriptor<(node: Node) => string>
  ) => {
    TagRegistry.register(target, name || desc.value!.name, desc.value!);
  };
}
