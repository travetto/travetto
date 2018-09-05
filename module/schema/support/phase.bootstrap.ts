const proto = (Function as any)['__proto__'];

function from(this: any, data: any, view?: string) {
  const { BindUtil } = require('../src/bind-util');
  // tslint:disable-next-line:no-invalid-this
  return BindUtil.bindSchema(this, new this(), data, view);
}

export const init = {
  key: 'schema',
  before: 'base', // Should be global
  action: () => proto.fromRaw = proto.from = from  // Register global from
};