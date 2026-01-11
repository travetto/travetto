import type eslint from 'eslint';

export type TrvEslintPlugin = {
  name: string;
  rules: Record<string, {
    defaultLevel?: Exclude<eslint.Linter.Config['rules'], undefined>[string];
    create(context: eslint.Rule.RuleContext): eslint.Rule.RuleListener;
  }>;
};