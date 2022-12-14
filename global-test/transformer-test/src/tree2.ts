type TreeNode2<T> = {
  value: T;
  left?: TreeNode2<T>;
  right?: TreeNode2<T>;
};

export class Service2 {
  getTree(): Promise<TreeNode2<number>> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return Promise.resolve({ value: 5 } as TreeNode2<number>);
  }
}