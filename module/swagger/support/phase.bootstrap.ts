export const init = { // Force loading, as it should never be referenced
  priority: 1,
  action: async () => {
    require('../src/service');
  }
};