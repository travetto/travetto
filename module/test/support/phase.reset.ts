export const init = {
  key: 'test',
  before: 'registry',
  action: async () => {
    const { TestRegistry } = await import('../src/registry/registry');
    await TestRegistry.reset();
  }
};