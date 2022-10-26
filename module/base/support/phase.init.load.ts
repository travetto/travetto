/**
 * Responsible for loading all available modules
 */
export const step = {
  key: '@trv:base/load',
  after: ['@trv:base/transpile'],
  action: async (): Promise<void> => {
    const { ModuleIndex } = await import('@travetto/boot');

    for (const { file } of ModuleIndex.findSrc({})) {
      await import(file);
    }
  }
};