import { Node } from 'parse5';

import type { Class } from '@travetto/base';

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
class $TagRegistry {
  private data: Map<Class, Record<string, (node: Node) => string>> = new Map();

  id(cls: unknown) {
    return cls && (cls as object).constructor !== Function ? (cls as object).constructor as Class : cls as Class;
  }

  getTag(tag: string | Node, ns: string) {
    return (typeof tag === 'string' ? tag : Parse5Adapter.getTagName(tag)).replace(new RegExp(`^${ns}`), '');
  }

  register(cls: Class, name: string, fn: (node: Node) => string) {
    cls = this.id(cls);
    if (!this.data.has(cls)) {
      this.data.set(cls, {});
    }
    this.data.get(cls)![name] = fn;
  }

  resolve(cls: Class, tag: string) {
    cls = this.id(cls);
    return this.data.get(cls)?.[tag];
  }

  has(cls: Class, tag: string) {
    cls = this.id(cls);
    return !!this.data.get(cls)?.[tag];
  }
}

export const TagRegistry = new $TagRegistry();

/**
 * Tag Decorator
 */
export function Tag(name?: string) {
  return (
    target: Class, prop: string | symbol, desc: TypedPropertyDescriptor<(node: Node) => string>
  ) => {
    TagRegistry.register(target, name || desc.value!.name, desc.value!);
  };
}
