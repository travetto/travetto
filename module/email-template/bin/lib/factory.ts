import type { Class, ClassInstance } from '@travetto/base';

import { Node, Element } from './types';
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
  #data: Map<Class, Record<string, (node: Element) => string>> = new Map();

  id(cls: unknown) {
    return cls && (cls as object).constructor !== Function ? (cls as object).constructor as Class : cls as Class;
  }

  getTag(tag: string | Element, ns: string) {
    return (typeof tag === 'string' ? tag : Parse5Adapter.getTagName(tag)).replace(new RegExp(`^${ns}`), '');
  }

  register(cls: ClassInstance, name: string, fn: (node: Element) => string) {
    cls = this.id(cls);
    if (!this.#data.has(cls)) {
      this.#data.set(cls, {});
    }
    this.#data.get(cls)![name] = fn;
  }

  resolve(cls: ClassInstance, tag: string) {
    cls = this.id(cls);
    return this.#data.get(cls)?.[tag];
  }

  has(cls: ClassInstance, tag: string) {
    cls = this.id(cls);
    return !!this.#data.get(cls)?.[tag];
  }
}

export const TagRegistry = new $TagRegistry();

/**
 * Tag Decorator
 */
export function Tag(name?: string) {
  return <T extends ClassInstance, U extends string = string>(
    target: T, prop: string | symbol, desc: TypedPropertyDescriptor<(node: Element) => U>
  ) => {
    TagRegistry.register(target, name || desc.value!.name, desc.value!);
  };
}
