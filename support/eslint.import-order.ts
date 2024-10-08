import type eslint from 'eslint';
import { Program, BaseExpression, Expression } from 'estree';

import type { TrvEslintPlugin } from '@travetto/eslint';

const groupTypeMap = {
  node: ['node', 'travetto', 'workspace'],
  travetto: ['travetto', 'workspace'],
  workspace: ['workspace'],
};

interface TSAsExpression extends BaseExpression {
  type: 'TSAsExpression';
  expression: Expression;
}

declare module 'estree' {
  interface ExpressionMap {
    TSAsExpression: TSAsExpression;
  }
}

export const ImportOrder: TrvEslintPlugin = {
  name: '@travetto-import',
  rules: {
    order: {
      defaultLevel: 'error',
      create(context) {
        function check({ body }: Program): void {
          let groupType: (keyof typeof groupTypeMap) | undefined;
          let groupSize = 0;
          let contiguous = false;
          let prev: eslint.AST.Program['body'][number] | undefined;

          for (const node of body) {

            let from: string | undefined;

            if (node.type === 'ImportDeclaration') {
              if (node.source?.value && typeof node.source.value === 'string') {
                from = node.source.value;
              }
            } else if (node.type === 'VariableDeclaration' && node.kind === 'const') {
              const [decl] = node.declarations;
              let call: Expression | undefined;
              const initType = decl?.init?.type;
              if (initType === 'CallExpression') {
                call = decl.init;
              } else if (initType === 'TSAsExpression') { // tslint support
                call = decl.init.expression;
              }
              if (
                call?.type === 'CallExpression' && call.callee.type === 'Identifier' &&
                call.callee.name === 'require' && call.arguments[0].type === 'Literal'
              ) {
                const arg1 = call.arguments[0];
                if (arg1.value && typeof arg1.value === 'string') {
                  from = arg1.value;
                }
              }
            }

            if (!from) {
              continue;
            }

            const lineType: typeof groupType = /^@travetto/.test(from) ? 'travetto' : /^[^.]/.test(from) ? 'node' : 'workspace';

            if (/module\/[^/]+\/doc\//.test(context.filename) && lineType === 'workspace' && from.startsWith('..')) {
              context.report({ message: 'Doc does not support parent imports', node });
            }

            if (groupType && !groupTypeMap[groupType].includes(lineType)) {
              context.report({ message: `Invalid transition from ${groupType} to ${lineType}`, node });
            }

            if (groupType === lineType) {
              groupSize += 1;
            } else if (((node.loc?.end.line ?? 0) - (prev?.loc?.end.line ?? 0)) > 1) {
              // Newlines
              contiguous = false;
              groupSize = 0;
            }

            if (groupSize === 0) { // New group, who dis
              groupSize = 1;
              groupType = lineType;
            } else if (groupType === lineType && !contiguous) { // Contiguous same
              // Do nothing
            } else if (groupSize === 1) { // Contiguous diff, count 1
              contiguous = true;
              groupType = lineType;
            } else { // Contiguous diff, count > 1
              context.report({ message: `Invalid contiguous groups ${groupType} and ${lineType}`, node });
            }
            prev = node;
          }
        }
        return { Program: check };
      }
    }
  }
};