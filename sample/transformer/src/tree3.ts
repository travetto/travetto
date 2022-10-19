
class Service3 {
  getTree(): Promise<{ value: number, left: { value: number } }> {
    return Promise.resolve({ value: 5, left: { value: 7 } } as const);
  }
}