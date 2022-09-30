import { TreeAdapter, serialize, defaultTreeAdapter, DefaultTreeAdapterMap } from 'parse5';

import { Node, Element, Document } from './types';

export const Parse5Adapter: TreeAdapter<DefaultTreeAdapterMap> = defaultTreeAdapter;

type AttrList = { name: string, value: string }[];

/**
 * Utilities for visiting html trees
 */
export class HtmlUtil {

  /**
   * Visit the tree
   */
  static visit(root: Document | Element, visitor: (node: Element, descend: () => void) => void): void {
    function traverse(node: Document | Element): void {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const children = (Parse5Adapter.getChildNodes(node) ?? []) as Element[];
      for (const child of children) {
        if (child) {
          visitor(child, traverse.bind(null, child));
        }
      }
    }
    traverse(root);
  }

  /**
   * Get hashmap of all attributes on the node
   */
  static getAttrMap(el: Element): Record<string, string> {
    const attrs = Parse5Adapter.getAttrList(el);
    if (!attrs) {
      return {};
    } else {
      return attrs.reduce<Record<string, string>>((acc, val) => {
        acc[val.name] = val.value;
        return acc;
      }, {});
    }
  }

  /**
   * Convert property map to html
   */
  static toStr(o: string[] | Record<string, string>): string {
    if (Array.isArray(o)) {
      return o.join(' ');
    } else {
      return Object.keys(o).filter(x => x && o[x] !== undefined).sort().map(x => `${x}="${o[x]}"`).join(' ');
    }
  }

  /**
   * Process all CSS classes
   */
  static classes(...args: string[]): string {
    return args.reduce<string[]>((acc, v) => {
      if (v) {
        acc.push(...v.split(' '));
      }
      return acc;
    }, []).join(' ');
  }

  /**
   * Set DOM Attribute to value
   */
  static setDomAttribute(node: Element, attrName: string, value: string): void {
    let attrList = Parse5Adapter.getAttrList(node);
    if (!attrList) {
      attrList = node.attrs = [];
    }
    const attr = attrList.find(x => x.name === attrName);

    if (!attr) {
      attrList.push({
        name: attrName,
        value
      });
    } else {
      attr.value = attrName === 'class' ? HtmlUtil.classes(attr.value, value) : value;
    }
  }

  /**
   * Get inner content
   */
  static getInner(node: Node): string {
    return serialize(node);
  }

  /**
   * Get inner text
   */
  static getInnerText(node: Node): string {
    return serialize(node).replace(/<\/?[^>]+>/g, '');
  }
}