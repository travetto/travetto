/**
 * Responsible for loading all available modules
 */
export const init = {
  key: '@trv:compiler/load',
  after: ['@trv:compiler/compile'],
  action: async () => {
    const { SourceCodeIndex } = await import('@travetto/boot/src/internal');
    const { AppManifest } = await import('@travetto/base');

    for (const { file } of SourceCodeIndex.findByFolders(AppManifest.source, 'required')) {
      // Use require vs import on purpose
      require(file); // Scan all files as compiler source root
    }
  }
};