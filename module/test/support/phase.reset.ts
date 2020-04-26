export const init = {
  key: 'test',
  action: async () => {
    const { TestRegistry } = await import('../src/registry/registry');
    await TestRegistry.reset();
  }
};