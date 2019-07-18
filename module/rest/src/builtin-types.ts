// tslint:disable:no-invalid-this
(Map as any).prototype.toJSON = function (this: Map<any, any>) {
  return JSON.stringify([...this.entries()].reduce((acc, [k, v]) => {
    acc[k] = v;
    return acc;
  }, {} as any));
};
(Set as any).prototype.toJSON = function (this: Set<any>) {
  return JSON.stringify([...this.values()]);
};
// tslint:enable:no-invalid-this
