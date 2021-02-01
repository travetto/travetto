import { TreeAdapter, Node, serialize, DefaultTreeElement } from 'parse5';

// TODO: Get proper typings
export const Parse5Adapter: TreeAdapter = require('parse5/lib/tree-adapters/default');

/**
 * Utilities for visiting html trees
 */
export class HtmlUtil {

  /**
   * Visit the tree
   */
  static visit(root: Node, visitor: (node: Node, descend: () => void) => void) {
    function traverse(node: Node) {
      const children = Parse5Adapter.getChildNodes(node) ?? [];
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
  static getAttrMap(el: Node) {
    const attrs = Parse5Adapter.getAttrList(el);
    if (!attrs) {
      return {} as Record<string, string>;
    } else {
      return attrs.reduce((acc, val) => {
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
  static setDomAttribute(node: Node, attrName: string, value: string) {
    let attrList = Parse5Adapter.getAttrList(node);
    if (!attrList) {
      attrList = (node as DefaultTreeElement).attrs = [];
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