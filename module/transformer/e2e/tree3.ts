
class Service3 {
  getTree() {
    return Promise.resolve({ value: 5, left: { value: 7 } } as const);
  }
}