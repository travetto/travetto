export const init = { // Force loading, as it should never be referenced
  priority: 0,
  action: async () => {
    require('../src/service');
  }
};