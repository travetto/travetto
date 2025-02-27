export const CONFIG_OVERRIDES = Symbol.for('@travetto/config:field-override');

export type ConfigOverrides = {
  ns: string;
  fields: Record<string, () => (unknown | undefined)>;
};

/**
 * Contract for all configuration classes
 * @concrete .
 */
export interface ConfigBase { }