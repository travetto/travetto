type TreeNode2<T> = {
  value: T;
  left?: TreeNode2<T>;
  right?: TreeNode2<T>;
};

class Service2 {
  getTree() {
    return Promise.resolve({ value: 5 } as TreeNode2<number>);
  }
}