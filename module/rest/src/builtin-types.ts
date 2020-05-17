// TODO: Document
(Map as any).prototype.toJSON = function (this: Map<any, any>) {
  return [...this.entries()].reduce((acc, [k, v]) => {
    acc[k] = v;
    return acc;
  }, {} as Record<string, any>);
};

(Set as any).prototype.toJSON = function (this: Set<any>) {
  return [...this.values()];
};
