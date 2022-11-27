export class Service3 {
  getTree(): Promise<{ value: number, left: { value: string } }> {
    return Promise.resolve({ value: 5, left: { value: 'bob' } } as const);
  }
}