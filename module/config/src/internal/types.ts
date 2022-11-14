export abstract class ConfigSourceTarget { }
export abstract class ConfigTarget { }
export abstract class ConfigParserTarget { }

export const CONFIG_OVERRIDES = Symbol.for('@trv:config/field-override');

export type ConfigOverrides = {
  ns: string;
  fields: Record<string, () => (unknown | undefined)>;
};