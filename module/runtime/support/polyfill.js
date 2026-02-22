import 'temporal-polyfill-lite/global';

Map.prototype.getOrInsert ??= function(key, value) {
  return (this.has(key) || this.set(key, value), this.get(key));
};

Map.prototype.getOrInsertComputed ??= function(key, compute) {
  return (this.has(key) || this.set(key, compute()), this.get(key));
};