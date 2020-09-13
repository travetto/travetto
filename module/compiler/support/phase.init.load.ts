/**
 * Responsible for loading all available modules
 */
export const init = {
  key: '@trv:compiler/load',
  after: ['@trv:compiler/compile'],
  action: async () => {
    const { ScanApp } = await import('@travetto/base');

    for (const { file } of ScanApp.findAppSourceFiles()) {
      require(file); // Scan all files as compiler source root
    }
  }
};