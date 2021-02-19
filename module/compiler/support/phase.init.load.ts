/**
 * Responsible for loading all available modules
 */
export const init = {
  key: '@trv:compiler/load',
  after: ['@trv:compiler/compile'],
  action: async () => {
    const { SourceIndex } = await import('@travetto/boot');
    const { AppManifest } = await import('@travetto/base');

    for (const { file } of SourceIndex.findByFolders(AppManifest.source, 'required')) {
      // Use require vs import on purpose
      require(file); // Scan all files as compiler source root
    }
  }
};