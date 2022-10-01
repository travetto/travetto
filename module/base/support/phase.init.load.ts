/**
 * Responsible for loading all available modules
 */
export const step = {
  key: '@trv:base/load',
  after: ['@trv:base/transpile'],
  action: async (): Promise<void> => {
    const { SourceIndex } = await import('@travetto/boot/src/internal/source');
    const { AppManifest } = await import('@travetto/base');

    for (const { file } of SourceIndex.findByFolders(AppManifest.source, 'required')) {
      // Use require vs import on purpose
      require(file); // Scan all files as compiler source root
    }
  }
};