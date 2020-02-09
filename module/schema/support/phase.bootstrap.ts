export const init = {
  key: 'schema',
  after: 'registry', // Should be global
  action: async () => {
    const { BindUtil } = await import('../src/bind-util');
    const proto = Object.getPrototypeOf(Function);
    proto.fromRaw = proto.from = function (data: any, view?: string) {
      return BindUtil.bindSchema(this, data, view);
    };
  }
};