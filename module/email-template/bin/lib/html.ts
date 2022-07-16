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
  static visit(root: Document | Element, visitor: (node: Element, descend: () => void) => void) {
    function traverse(node: Document | Element) {
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
  static getAttrMap(el: Element) {
    const attrs = Parse5Adapter.getAttrList(el) as AttrList;
    if (!attrs) {
      return {} as Record<string, string>;
    } else {
      return attrs.reduce((acc: Record<string, string>, val) => {
        acc[val.name] = val.value;
        return acc;
      }, {} as Record<string, string>);
    }
  }

  /**
   * Convert property map to html
   */
  static toStr(o: string[] | Record<string, string>) {
    if (Array.isArray(o)) {
      return o.join(' ');
    } else {
      return Object.keys(o).filter(x => x && o[x] !== undefined).sort().map(x => `${x}="${o[x]}"`).join(' ');
    }
  }

  /**
   * Process all CSS classes
   */
  static classes(...args: string[]) {
    return args.reduce((acc, v) => {
      if (v) {
        acc.push(...v.split(' '));
      }
      return acc;
    }, [] as string[]).join(' ');
  }

  /**
   * Set DOM Attribute to value
   */
  static setDomAttribute(node: Element, attrName: string, value: string) {
    let attrList = Parse5Adapter.getAttrList(node) as AttrList;
    if (!attrList) {
      attrList = (node as { attrs: AttrList }).attrs = [];
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
  static getInner(node: Node) {
    return serialize(node);
  }

  /**
   * Get inner text
   */
  static getInnerText(node: Node) {
    return serialize(node).replace(/<\/?[^>]+>/g, '');
  }
}