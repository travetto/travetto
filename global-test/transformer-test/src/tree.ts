interface TreeNode<T> {
  value: T;
  left?: TreeNode<T>;
  right?: TreeNode<T>;
}

export class Service {
  getTree(): TreeNode<number> | undefined {
    return { ['value']: 5 };
  }
}