import { TreeAdapter, Node, serialize, DefaultTreeElement } from 'parse5';

export const Adapter: TreeAdapter = require('parse5/lib/tree-adapters/default');

export function visit<T>(root: Node, visitor: (node: Node, descend: () => void) => void) {
  function traverse(node: Node) {
    const children = Adapter.getChildNodes(node) || [];
    for (const child of children) {
      if (child) {
        visitor(child, traverse.bind(null, child));
      }
    }
  }
  traverse(root);
}

export function getAttrMap(el: Node) {
  const attrs = Adapter.getAttrList(el);
  if (!attrs) {
    return {} as { [key: string]: string };
  } else {
    return attrs.reduce((acc, val) => {
      acc[val.name] = val.value;
      return acc;
    }, {} as { [key: string]: string });
  }
}

export function toStr(o: string[] | { [key: string]: string }) {
  if (Array.isArray(o)) {
    return o.join(' ');
  } else {
    return Object.keys(o).filter(x => x && o[x] !== undefined).sort().map(x => `${x}="${o[x]}"`).join(' ');
  }
}

export function classes(...args: string[]) {
  return args.reduce((acc, v) => {
    if (v) {
      acc.push(...v.split(' '));
    }
    return acc;
  }, [] as string[]).join(' ');
}

export function setDomAttribute(node: Node, attrName: string, value: string) {
  let attrList = Adapter.getAttrList(node);
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
    attr.value = attrName === 'class' ? classes(attr.value, value) : value;
  }
}

export function getInner(node: Node) {
  return serialize(node);
}