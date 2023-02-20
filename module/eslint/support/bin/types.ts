export type TrvEslintPlugin = {
  name: string;
  rules: Record<string, {
    defaultLevel?: string | boolean | number;
    create: Function;
  }>;
};