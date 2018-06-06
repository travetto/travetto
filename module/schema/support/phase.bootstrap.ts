export const init = {
  priority: 0, // Should be global
  action: () => {
    require('../src/util/bind').declareFrom();
  }
};