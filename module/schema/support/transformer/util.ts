import ts from 'typescript';
import {
  type AnyType, DeclarationUtil, LiteralUtil,
  DecoratorUtil, DocUtil, ParamDocumentation, TransformerState, transformCast,
} from '@travetto/transformer';

export type ComputeConfig = { type?: AnyType, root?: ts.Node, name?: string, index?: number };

export class SchemaTransformUtil {

  static SCHEMA_IMPORT = '@travetto/schema/src/decorator/schema.ts';
  static METHOD_IMPORT = '@travetto/schema/src/decorator/method.ts';
  static FIELD_IMPORT = '@travetto/schema/src/decorator/field.ts';
  static INPUT_IMPORT = '@travetto/schema/src/decorator/input.ts';
  static COMMON_IMPORT = '@travetto/schema/src/decorator/common.ts';
  static TYPES_IMPORT = '@travetto/schema/src/types.ts';

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
      case 'mapped': {
        const base = state.getOrImport(type);
        const uniqueId = state.generateUniqueIdentifier(node, type, 'Δ');
        const [id, existing] = state.registerIdentifier(uniqueId);
        if (!existing) {
          const cls = state.factory.createClassDeclaration(
            [
              state.createDecorator(this.SCHEMA_IMPORT, 'Schema', state.fromLiteral({
                description: type.comment,
                mappedOperation: type.operation,
                mappedFields: type.fields,
              })),
            ],
            id, [], [state.factory.createHeritageClause(
              ts.SyntaxKind.ExtendsKeyword, [state.factory.createExpressionWithTypeArguments(base, [])]
            )], []
          );
          cls.getText = (): string => `
class ${uniqueId} extends ${type.mappedClassName} { 
  fields: ${type.fields?.join(', ')} 
  operation: ${type.operation}
}`;
          state.addStatements([cls], root || node);
        }
        return id;
      }
      case 'unknown': {
        const imp = state.importFile(this.TYPES_IMPORT);
        return state.createAccess(imp.identifier, 'UnknownType');
      }
      case 'shape': {
        const uniqueId = state.generateUniqueIdentifier(node, type, 'Δ');

        // Build class on the fly
        const [id, existing] = state.registerIdentifier(uniqueId);
        if (!existing) {
          const cls = state.factory.createClassDeclaration(
            [
              state.createDecorator(this.SCHEMA_IMPORT, 'Schema', state.fromLiteral({
                description: type.comment
              })),
            ],
            id, [], [],
            Object.entries(type.fieldTypes)
              .map(([k, v]) =>
                this.computeInput(state, state.factory.createPropertyDeclaration(
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
   * Compute decorator params from property/parameter/getter/setter
   */
  static computeInputDecoratorParams<T extends ts.PropertyDeclaration | ts.ParameterDeclaration | ts.GetAccessorDeclaration | ts.SetAccessorDeclaration>(
    state: TransformerState,
    node: T,
    config?: ComputeConfig
  ): ts.Expression[] {
    const typeExpr = config?.type ?? state.resolveType(ts.isSetAccessor(node) ? node.parameters[0] : node);
    const attrs: Record<string, string | boolean | object | number | ts.Expression> = {};

    if (!ts.isGetAccessorDeclaration(node) && !ts.isSetAccessorDeclaration(node)) {
      // eslint-disable-next-line no-bitwise
      if ((ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Readonly) > 0) {
        attrs.access = 'readonly';
      } else if (!!node.questionToken || !!typeExpr.undefinable || !!node.initializer) {
        attrs.required = { active: false };
      }
      if (node.initializer !== undefined && (
        ts.isLiteralExpression(node.initializer) ||
        node.initializer.kind === ts.SyntaxKind.TrueKeyword ||
        node.initializer.kind === ts.SyntaxKind.FalseKeyword ||
        (ts.isArrayLiteralExpression(node.initializer) && node.initializer.elements.length === 0)
      )) {
        attrs.default = node.initializer;
      }
    } else {
      const acc = DeclarationUtil.getAccessorPair(node);
      attrs.accessor = true;
      if (!acc.setter) {
        attrs.access = 'readonly';
      }
      if (!acc.getter) {
        attrs.access = 'writeonly';
      } else if (!!typeExpr.undefinable) {
        attrs.required = { active: false };
      }
    }

    const rawName = node.getSourceFile()?.text ? node.name.getText() ?? undefined : undefined;
    const providedName = config?.name ?? rawName!;
    attrs.name = providedName;

    if (rawName !== providedName && rawName) {
      attrs.sourceText = rawName;
    }

    const primaryExpr = typeExpr.key === 'literal' && typeExpr.typeArguments?.[0] ? typeExpr.typeArguments[0] : typeExpr;

    // We need to ensure we aren't being tripped up by the wrapper for arrays, sets, etc.
    // If we have a composition type
    if (primaryExpr.key === 'composition') {
      const values = primaryExpr.subTypes.map(x => x.key === 'literal' ? x.value : undefined)
        .filter(x => x !== undefined && x !== null);

      if (values.length === primaryExpr.subTypes.length) {
        attrs.enum = {
          values,
          message: `{path} is only allowed to be "${values.join('" or "')}"`
        };
      }
    } else if (primaryExpr.key === 'template' && primaryExpr.template) {
      const re = LiteralUtil.templateLiteralToRegex(primaryExpr.template);
      attrs.match = {
        re: new RegExp(re),
        template: primaryExpr.template,
        message: `{path} must match "${re}"`
      };
    }

    if (ts.isParameter(node)) {
      const parentComments = DocUtil.describeDocs(node.parent);
      const paramComments: Partial<ParamDocumentation> = (parentComments.params ?? []).find(x => x.name === node.name.getText()) || {};
      if (paramComments.description) {
        attrs.description = paramComments.description;
      }
    } else {
      const comments = DocUtil.describeDocs(node);
      if (comments.description) {
        attrs.description = comments.description;
      }
    }

    const tags = ts.getJSDocTags(node);
    const aliases = tags.filter(x => x.tagName.getText() === 'alias');
    if (aliases.length) {
      attrs.aliases = aliases.map(x => x.comment).filter(x => !!x);
    }

    const params: ts.Expression[] = [];

    const existing =
      state.findDecorator('@travetto/schema', node, 'Field', this.FIELD_IMPORT) ??
      state.findDecorator('@travetto/schema', node, 'Input', this.INPUT_IMPORT);

    if (config?.index !== undefined) {
      attrs.index = config.index;
    }

    if (Object.keys(attrs).length) {
      params.push(state.fromLiteral(attrs));
    }

    if (!existing) {
      const resolved = this.toConcreteType(state, typeExpr, node, config?.root ?? node);
      const type = typeExpr.key === 'foreign' ? state.getConcreteType(node) :
        ts.isArrayLiteralExpression(resolved) ? resolved.elements[0] : resolved;

      params.unshift(LiteralUtil.fromLiteral(state.factory, {
        array: ts.isArrayLiteralExpression(resolved),
        type
      }));
    } else {
      const args = DecoratorUtil.getArguments(existing) ?? [];
      if (args.length > 0) {
        params.unshift(args[0]);
      }
      if (args.length > 1) {
        params.push(...args.slice(1));
      }
    }

    return params;
  }

  /**
   * Compute property information from declaration
   */
  static computeInput<T extends ts.PropertyDeclaration | ts.ParameterDeclaration | ts.GetAccessorDeclaration | ts.SetAccessorDeclaration>(
    state: TransformerState, node: T, config?: ComputeConfig
  ): T {
    const existingField = state.findDecorator('@travetto/schema', node, 'Field', this.FIELD_IMPORT);
    const existingInput = state.findDecorator('@travetto/schema', node, 'Input', this.INPUT_IMPORT);
    const params = this.computeInputDecoratorParams(state, node, config);

    let modifiers: ts.ModifierLike[];
    if (existingField) {
      const decorator = state.createDecorator(this.FIELD_IMPORT, 'Field', ...params);
      modifiers = DecoratorUtil.spliceDecorators(node, existingField, [decorator]);
    } else {
      const decorator = state.createDecorator(this.INPUT_IMPORT, 'Input', ...params);
      modifiers = DecoratorUtil.spliceDecorators(node, existingInput, [decorator]);
    }

    let result: unknown;
    if (ts.isPropertyDeclaration(node)) {
      result = state.factory.updatePropertyDeclaration(node,
        modifiers, node.name, node.questionToken, node.type, node.initializer);
    } else if (ts.isParameter(node)) {
      result = state.factory.updateParameterDeclaration(node,
        modifiers, node.dotDotDotToken, node.name, node.questionToken, node.type, node.initializer);
    } else if (ts.isGetAccessorDeclaration(node)) {
      result = state.factory.updateGetAccessorDeclaration(node,
        modifiers, node.name, node.parameters, node.type, node.body);
    } else {
      result = state.factory.updateSetAccessorDeclaration(node,
        modifiers, node.name, node.parameters, node.body);
    }
    return transformCast(result);
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
      case 'foreign': {
        out.type = state.getForeignTarget(type);
        break;
      }
      case 'managed': out.type = state.typeToIdentifier(type); break;
      case 'mapped': out.type = this.toConcreteType(state, type, target); break;
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
        const [decorator] = DeclarationUtil.getDeclarations(type.original!);
        cls = decorator && ts.isClassDeclaration(decorator) ? decorator : undefined;
        break;
      }
      case 'shape': cls = type.original; break;
    }
    if (cls) {
      return state.findMethodByName(cls, methodName);
    }
  }

  /**
   * Compute return type decorator params
   */
  static computeReturnTypeDecoratorParams(state: TransformerState, node: ts.MethodDeclaration): ts.Expression[] {
    // If we have a valid response type, declare it
    const returnType = state.resolveReturnType(node);
    let targetType = returnType;

    if (returnType.key === 'literal' && returnType.typeArguments?.length && returnType.name === 'Promise') {
      targetType = returnType.typeArguments[0];
    }

    // TODO: Standardize this using jsdoc
    let innerReturnType: AnyType | undefined;
    if (targetType.key === 'managed' && targetType.importName.startsWith('@travetto/')) {
      innerReturnType = state.getApparentTypeOfField(targetType.original!, 'body');
    }

    const finalReturnType = SchemaTransformUtil.ensureType(state, innerReturnType ?? returnType, node);
    return finalReturnType ? [state.fromLiteral({ returnType: finalReturnType })] : [];
  }
}