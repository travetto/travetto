import { TreeAdapter, Node, serialize, DefaultTreeElement } from 'parse5';

export const Parse5Adapter: TreeAdapter = require('parse5/lib/tree-adapters/default');

// TODO: Document
export class HtmlUtil {

  static visit<T>(root: Node, visitor: (node: Node, descend: () => void) => void) {
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

  static toStr(o: string[] | Record<string, string>) {
    if (Array.isArray(o)) {
      return o.join(' ');
    } else {
      return Object.keys(o).filter(x => x && o[x] !== undefined).sort().map(x => `${x}="${o[x]}"`).join(' ');
    }
  }

  static classes(...args: string[]) {
    return args.reduce((acc, v) => {
      if (v) {
        acc.push(...v.split(' '));
      }
      return acc;
    }, [] as string[]).join(' ');
  }

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

  static getInner(node: Node) {
    return serialize(node);
  }

  static getInnerText(node: Node) {
    return serialize(node).replace(/<\/?[^>]+>/g, '');
  }
}