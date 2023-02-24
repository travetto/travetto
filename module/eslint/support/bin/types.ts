import type eslint from 'eslint';

export type TrvEslintPlugin = {
  name: string;
  rules: Record<string, {
    defaultLevel?: string | boolean | number;
    create(context: eslint.Rule.RuleContext): eslint.Rule.RuleListener;
  }>;
};