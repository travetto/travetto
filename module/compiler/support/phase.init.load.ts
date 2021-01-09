/**
 * Responsible for loading all available modules
 */
export const init = {
  key: '@trv:compiler/load',
  after: ['@trv:compiler/compile'],
  action: async () => {
    const { ScanApp } = await import('@travetto/base');

    for (const { file } of ScanApp.findAllSourceFiles()) {
      if (!file.endsWith('.opt.ts')) { // Exclude optional load
        require(file); // Scan all files as compiler source root
      }
    }
  }
};