import ts from 'typescript';
import {
  type AnyType, DeclarationUtil, LiteralUtil,
  DecoratorUtil, DocUtil, ParamDocumentation, TransformerState, transformCast,
} from '@travetto/transformer';


export class SchemaTransformUtil {

  static SCHEMA_MOD = '@travetto/schema/src/decorator/schema';
  static SCHEMA_IMPORT = `${this.SCHEMA_MOD}.ts`;
  static FIELD_MOD = '@travetto/schema/src/decorator/field';
  static FIELD_IMPORT = `${this.FIELD_MOD}.ts`;
  static COMMON_IMPORT = '@travetto/schema/src/decorator/common.ts';
  static TYPES_IMPORT = '@travetto/schema/src/internal/types.ts';

  /**
   * Produce concrete type given transformer type
   */
  static toConcreteType(state: TransformerState, type: AnyType, node: ts.Node, root: ts.Node = node): ts.Expression {
    switch (type.key) {
      case 'pointer': return this.toConcreteType(state, type.target, node, root);
      case 'managed': return state.getOrImport(type);
      case 'tuple': return state.fromLiteral(type.subTypes.map(x => this.toConcreteType(state, x, node, root)!));
      case 'template': return state.createIdentifier(type.ctor.name);
      case 'literal': {
        if ((type.ctor === Array) && type.typeArguments?.length) {
          return state.fromLiteral([this.toConcreteType(state, type.typeArguments[0], node, root)]);
        } else if (type.ctor) {
          return state.createIdentifier(type.ctor.name!);
        }
        break;
      }
      case 'unknown': {
        const imp = state.importFile(this.TYPES_IMPORT);
        return state.createAccess(imp.ident, 'UnknownType');
      }
      case 'shape': {
        const uniqueId = state.generateUniqueIdentifier(node, type, 'Δ');

        // Build class on the fly
        const [id, existing] = state.registerIdentifier(uniqueId);
        if (!existing) {
          const cls = state.factory.createClassDeclaration(
            [
              state.createDecorator(this.SCHEMA_IMPORT, 'Schema'),
              state.createDecorator(this.COMMON_IMPORT, 'Describe',
                state.fromLiteral({
                  title: type.name,
                  description: type.comment
                })
              )
            ],
            id, [], [],
            Object.entries(type.fieldTypes)
              .map(([k, v]) =>
                this.computeField(state, state.factory.createPropertyDeclaration(
                  [], /\W/.test(k) ? state.factory.createComputedPropertyName(state.fromLiteral(k)) : k,
                  v.undefinable || v.nullable ? state.factory.createToken(ts.SyntaxKind.QuestionToken) : undefined,
                  v.key === 'unknown' ? state.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword) : undefined, undefined
                ), { type: v, root })
              )
          );
          cls.getText = (): string => [
            `class ${uniqueId} {`,
            ...Object.entries(type.fieldTypes)
              .map(([k, v]) => `  ${k}${v.nullable ? '?' : ''}: ${v.name};`),
            '}'
          ].join('\n');
          state.addStatements([cls], root || node);
        }
        return id;
      }
      case 'composition': {
        if (type.commonType) {
          return this.toConcreteType(state, type.commonType, node, root);
        }
        break;
      }
      case 'foreign':
      default: {
        // Object
      }
    }
    return state.createIdentifier('Object');
  }

  /**
   * Compute property information from declaration
   */
  static computeField<T extends ts.PropertyDeclaration | ts.ParameterDeclaration | ts.GetAccessorDeclaration | ts.SetAccessorDeclaration>(
    state: TransformerState, node: T, config: { type?: AnyType, root?: ts.Node, name?: string } = { root: node }
  ): T {

    const typeExpr = config.type ?? state.resolveType(ts.isSetAccessor(node) ? node.parameters[0] : node);
    const attrs: ts.PropertyAssignment[] = [];

    if (!ts.isGetAccessorDeclaration(node) && !ts.isSetAccessorDeclaration(node)) {
      // eslint-disable-next-line no-bitwise
      if ((ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Readonly) > 0) {
        attrs.push(state.factory.createPropertyAssignment('access', state.fromLiteral('readonly')));
      } else if (!node.questionToken && !typeExpr.undefinable && !node.initializer) {
        attrs.push(state.factory.createPropertyAssignment('required', state.fromLiteral({ active: true })));
      }
      if (node.initializer && (
        ts.isLiteralExpression(node.initializer) ||
        (ts.isArrayLiteralExpression(node.initializer) && node.initializer.elements.length === 0)
      )) {
        attrs.push(state.factory.createPropertyAssignment('default', node.initializer));
      }
    } else {
      const acc = DeclarationUtil.getAccessorPair(node);
      attrs.push(state.factory.createPropertyAssignment('accessor', state.fromLiteral(true)));
      if (!acc.setter) {
        attrs.push(state.factory.createPropertyAssignment('access', state.fromLiteral('readonly')));
      }
      if (!acc.getter) {
        attrs.push(state.factory.createPropertyAssignment('access', state.fromLiteral('writeonly')));
      } else if (!typeExpr.undefinable) {
        attrs.push(state.factory.createPropertyAssignment('required', state.fromLiteral({ active: true })));
      }
    }

    if (ts.isParameter(node) || config.name !== undefined) {
      attrs.push(state.factory.createPropertyAssignment('name', state.factory.createStringLiteral(
        config.name !== undefined ? config.name : node.name.getText())
      ));
    }

    const primaryExpr = typeExpr.key === 'literal' && typeExpr.typeArguments?.[0] ? typeExpr.typeArguments[0] : typeExpr;

    // We need to ensure we aren't being tripped up by the wrapper for arrays, sets, etc.
    // If we have a composition type
    if (primaryExpr.key === 'composition') {
      const values = primaryExpr.subTypes.map(x => x.key === 'literal' ? x.value : undefined)
        .filter(x => x !== undefined && x !== null);

      if (values.length === primaryExpr.subTypes.length) {
        attrs.push(state.factory.createPropertyAssignment('enum', state.fromLiteral({
          values,
          message: `{path} is only allowed to be "${values.join('" or "')}"`
        })));
      }
    } else if (primaryExpr.key === 'template' && primaryExpr.template) {
      const re = LiteralUtil.templateLiteralToRegex(primaryExpr.template);
      attrs.push(state.factory.createPropertyAssignment('match', state.fromLiteral({
        re: new RegExp(re),
        template: primaryExpr.template,
        message: `{path} must match "${re}"`
      })));
    }

    if (ts.isParameter(node)) {
      const comments = DocUtil.describeDocs(node.parent);
      const commentConfig: Partial<ParamDocumentation> = (comments.params ?? []).find(x => x.name === node.name.getText()) || {};
      if (commentConfig.description) {
        attrs.push(state.factory.createPropertyAssignment('description', state.fromLiteral(commentConfig.description)));
      }
    }

    const tags = ts.getJSDocTags(node);
    const aliases = tags.filter(x => x.tagName.getText() === 'alias');
    if (aliases.length) {
      attrs.push(state.factory.createPropertyAssignment('aliases', state.fromLiteral(aliases.map(x => x.comment).filter(x => !!x))));
    }

    const params: ts.Expression[] = [];

    const existing = state.findDecorator('@travetto/schema', node, 'Field', this.FIELD_MOD);
    if (!existing) {
      const resolved = this.toConcreteType(state, typeExpr, node, config.root);
      params.push(resolved);
      if (attrs.length) {
        params.push(state.factory.createObjectLiteralExpression(attrs));
      }
    } else {
      const args = DecoratorUtil.getArguments(existing) ?? [];
      if (args.length > 0) {
        params.push(args[0]);
      }
      params.push(state.factory.createObjectLiteralExpression(attrs));
      if (args.length > 1) {
        params.push(...args.slice(1));
      }
    }

    const newModifiers = [
      ...(node.modifiers ?? []).filter(x => x !== existing),
      state.createDecorator(this.FIELD_IMPORT, 'Field', ...params)
    ];

    let ret: unknown;
    if (ts.isPropertyDeclaration(node)) {
      const comments = DocUtil.describeDocs(node);
      if (comments.description) {
        newModifiers.push(state.createDecorator(this.COMMON_IMPORT, 'Describe', state.fromLiteral({
          description: comments.description
        })));
      }

      ret = state.factory.updatePropertyDeclaration(node,
        newModifiers, node.name, node.questionToken, node.type, node.initializer);
    } else if (ts.isParameter(node)) {
      ret = state.factory.updateParameterDeclaration(node,
        newModifiers, node.dotDotDotToken, node.name, node.questionToken, node.type, node.initializer);
    } else if (ts.isGetAccessorDeclaration(node)) {
      ret = state.factory.updateGetAccessorDeclaration(node,
        newModifiers, node.name, node.parameters, node.type, node.body);
    } else {
      ret = state.factory.updateSetAccessorDeclaration(node,
        newModifiers, node.name, node.parameters, node.body);
    }
    return transformCast(ret);
  }

  /**
   * Unwrap type
   */
  static unwrapType(type: AnyType): { out: Record<string, unknown>, type: AnyType } {
    const out: Record<string, unknown> = {};

    while (type?.key === 'literal' && type.typeArguments?.length) {
      if (type.ctor === Array) {
        out.array = true;
      }
      type = type.typeArguments?.[0] ?? { key: 'literal', ctor: Object }; // We have a promise nested
    }
    return { out, type };
  }

  /**
   * Ensure type
   * @param state
   * @param node
   */
  static ensureType(state: TransformerState, anyType: AnyType, target: ts.Node): Record<string, unknown> {
    const { out, type } = this.unwrapType(anyType);
    switch (type?.key) {
      case 'managed': out.type = state.typeToIdentifier(type); break;
      case 'shape': out.type = this.toConcreteType(state, type, target); break;
      case 'template': out.type = state.factory.createIdentifier(type.ctor.name); break;
      case 'literal': {
        if (type.ctor) {
          out.type = out.array ?
            this.toConcreteType(state, type, target) :
            state.factory.createIdentifier(type.ctor.name);
        }
      }
    }
    return out;
  }

  /**
   * Find inner return method
   * @param state
   * @param node
   * @param methodName
   * @returns
   */
  static findInnerReturnMethod(state: TransformerState, node: ts.MethodDeclaration, methodName: string): ts.MethodDeclaration | undefined {
    // Process returnType
    const { type } = this.unwrapType(state.resolveReturnType(node));
    let cls;
    switch (type?.key) {
      case 'managed': {
        const [dec] = DeclarationUtil.getDeclarations(type.original!);
        cls = dec && ts.isClassDeclaration(dec) ? dec : undefined;
        break;
      }
      case 'shape': cls = type.original; break;
    }
    if (cls) {
      return state.findMethodByName(cls, methodName);
    }
  }
}