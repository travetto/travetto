/**
 * Utility to make a property accessor enumerable at runtime
 */
export function registerAccessor(instance: any, property: string): void {
  Object.defineProperty(instance, property, {
    ...Object.getOwnPropertyDescriptor(Object.getPrototypeOf(instance), property),
    enumerable: true
  });
}
