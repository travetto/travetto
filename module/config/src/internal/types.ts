export abstract class ConfigTarget { }

export const CONFIG_OVERRIDES = Symbol.for('@travetto/config:field-override');

export type ConfigOverrides = {
  ns: string;
  fields: Record<string, () => (unknown | undefined)>;
};