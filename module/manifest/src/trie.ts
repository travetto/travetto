type TrieNode<T> = {
  value?: T;
  subs: Record<string, TrieNode<T>>;
}

/**
 * Efficient lookup for path-based graphs
 */
export class Trie<T> {
  root: TrieNode<T>;

  constructor(inputs: T[], getPath: (v: T) => string[]) {
    this.root = { subs: {} };
    for (const item of inputs) {
      const pth = getPath(item);
      if (pth.length) {
        let node = this.root;
        for (const sub of pth) {
          node = node.subs[sub] ??= { subs: {} };
        }
        node.value = item;
      } else {
        this.root.value = item;
      }
    }
  }

  lookup(path: string[], validate?: (node: TrieNode<T> | undefined, pth: string[]) => boolean): T | undefined {
    let node = this.root;
    let value = node.value;
    let i = 0;

    for (const sub of path) {
      if (node) {
        node = node.subs[sub];
        value = node?.value ?? value;
      } else if (validate && !validate(node, path.slice(0, i))) {
        value = undefined;
        break;
      }
      i += 1;
    }

    return value;
  }
}