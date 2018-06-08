const proto = (Function as any)['__proto__'];

function from(this: any, data: any, view?: string) {
  const { BindUtil } = require('../src/util/bind');
  // tslint:disable-next-line:no-invalid-this
  return BindUtil.bindSchema(this, new this(), data, view);
}

export const init = {
  priority: -1, // Should be global
  action: () => proto.from = from  // Register global from
};