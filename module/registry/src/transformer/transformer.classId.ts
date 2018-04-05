import * as ts from 'typescript';
import * as path from 'path';
import { TransformUtil, Import, State } from '@travetto/compiler';
const farmhash = require('farmhash');

const SEP = path.sep;
const RE_SEP = SEP === '/' ? '\\/' : SEP;
const SRC_RE = new RegExp(`([^/]+)${RE_SEP}src${RE_SEP}`, 'g');
const PATH_RE = new RegExp(RE_SEP, 'g');

type MethodHashes = { [key: string]: { hash: number, clsId: ts.Identifier } };

interface IState extends State {
  file: string;
  fullFile: string;
  imported?: ts.Identifier;
  methodHashes: { [key: string]: MethodHashes };
}

function createStaticField(name: string, val: ts.Expression | string | number) {
  return ts.createProperty(
    undefined,
    [ts.createToken(ts.SyntaxKind.StaticKeyword)],
    name, undefined, undefined, ['string', 'number'].includes(typeof val) ? ts.createLiteral(val as any) : val as ts.Expression
  );
}

function visitNode<T extends ts.Node>(context: ts.TransformationContext, node: T, state: IState): T {
  if (ts.isClassDeclaration(node) && node.name) {
    if (!state.imported) {
      state.imported = ts.createIdentifier(`import_Register`);
      state.newImports.push({
        ident: state.imported,
        path: require.resolve('../decorator/register')
      });
    }

    const hashes: MethodHashes = {};

    for (const child of node.members) {
      if (ts.isMethodDeclaration(child)) {
        const hash = farmhash.hash32(child.getText());
        hashes[child.name.getText()] = {
          hash, clsId: node.name
        };
      }
    }

    state.methodHashes[node.name.getText()] = hashes;

    node = ts.updateClassDeclaration(node,
      ts.createNodeArray(
        [ts.createDecorator(
          ts.createCall(ts.createPropertyAccess(state.imported, ts.createIdentifier('Register')), undefined, [])
        ), ...(node.decorators || [])]),
      node.modifiers,
      node.name,
      node.typeParameters,
      ts.createNodeArray(node.heritageClauses),
      ts.createNodeArray([
        createStaticField('__filename', state.fullFile),
        createStaticField('__id', `${state.file}#${node.name!.getText()}`),
        createStaticField('__hash', farmhash.hash32(node.getText())),
        ...node.members
      ])
    ) as any;

    return node;
  }
  return ts.visitEachChild(node, c => visitNode(context, c, state), context);
}

export const ClassIdTransformer = {
  transformer: (context: ts.TransformationContext) => {
    return (sfile: ts.SourceFile) => {
      const methodHashes: { [key: string]: MethodHashes } = {};

      const res = TransformUtil.importingVisitor<IState>((file: ts.SourceFile) => {
        let fileRoot = file.fileName.split(process.cwd() + SEP)[1];
        let ns = '@app';
        if (fileRoot.startsWith(`node_modules${SEP}`)) {
          fileRoot = fileRoot.split(`node_modules${SEP}`).pop()!;
          if (fileRoot.startsWith('@')) {
            const [ns1, ns2, ...rest] = fileRoot.split(SEP);
            ns = `${ns1}.${ns2}`;
            fileRoot = rest.join(SEP);
          }
        }

        fileRoot = fileRoot
          .replace(PATH_RE, '.')
          .replace(/^\./, '')
          .replace(/\.(t|j)s$/, '');

        return { file: `${ns}:${fileRoot}`, fullFile: file.fileName, newImports: [], imports: new Map(), methodHashes };
      }, visitNode)(context)(sfile);

      const hashDecls: any = [];

      for (const cls of Object.keys(methodHashes)) {
        for (const meth of Object.keys(methodHashes[cls])) {
          const { hash, clsId } = methodHashes[cls][meth];
          hashDecls.push(ts.createAssignment(
            ts.createPropertyAccess(
              ts.createPropertyAccess(
                ts.createPropertyAccess(clsId, 'prototype'),
                meth
              ),
              '__hash'
            ),
            ts.createLiteral(hash)
          ));
        }
      }

      res.statements = ts.createNodeArray([
        ...res.statements,
        hashDecls
      ]);

      return res;
    }
  },
  phase: 'before',
  priority: 1
}