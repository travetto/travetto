import fs from 'node:fs/promises';
import path from 'node:path';

import { BinaryUtil, Class, Runtime, Util, castTo, describeFunction } from '@travetto/runtime';
import { ControllerConfig, ControllerRegistry, ControllerVisitor, ControllerVisitUtil, EndpointConfig } from '@travetto/rest';
import { AllViewSymbol, ClassConfig, FieldConfig, SchemaNameResolver, SchemaRegistry, TemplateLiteral } from '@travetto/schema';

import { UnknownType } from '@travetto/schema/src/internal/types';

import { ParamConfig } from './shared/types';
import type { EndpointDesc, Imp, RenderContent } from './types';

export const TYPE_MAPPING = new Map<Function, string>([
  [String, 'string'],
  [BigInt, 'bigint'],
  [Number, 'number'],
  [Date, 'Date'],
  [Boolean, 'boolean'],
  [Object, 'Record<string, unknown>'],
  [UnknownType, 'unknown']
]);

/**
  * Recreate a template literal from AST
  */
const recreateTemplateLiteral = (template: TemplateLiteral, escape = false): string => {
  const out: string[] = [];
  for (const el of template.values) {
    if (el === String || el === Boolean || el === Number) {
      out.push(`\${${el.name.toLowerCase()}}`);
    } else if (typeof el === 'string' || typeof el === 'number' || typeof el === 'boolean') {
      out.push(`${el}`);
    } else {
      out.push(`(${recreateTemplateLiteral(castTo(el), true)})`);
    }
  }
  const body = (template.op === 'or') ? out.join('|') : out.join('');
  return escape ? `\`${body}\`` : body;
};

/**
 * Base functional skeleton for generating rest client artifacts
 */
export abstract class BaseClientGenerator<C = unknown> implements ControllerVisitor {

  #output: string;
  #schemaContent = new Map<string, RenderContent>();
  #controllerContent = new Map<string, RenderContent>();
  #otherContent = new Map<string, RenderContent>();
  #imports = new Set<string>();
  #nameResolver = new SchemaNameResolver();

  abstract get commonFiles(): [string, Class | string][];
  abstract get subFolder(): string;
  abstract get endpointResponseWrapper(): (string | Imp)[];
  abstract get outputExt(): '.js' | '.ts' | '';

  abstract renderController(cfg: ControllerConfig): RenderContent;

  moduleName: string;
  config: Partial<C> = {};

  constructor(output: string, moduleName?: string, config: Partial<C> = {}) {
    this.#output = output;
    this.moduleName = moduleName ?? `${Runtime.main.name}-client`;
    this.config = config;
    this.init?.();
  }

  init?(): void;

  get uploadType(): string | Imp { return '(File | Blob)'; }

  writeContentFilter(text: string): string {
    return text
      .replace(/^((?:ex|im)port\s+[^;]*\s+from\s*[^;]+)';$/gsm, (_, x) => `${x.replace(/[.]ts$/, '')}${this.outputExt}';`)
      // eslint-disable-next-line no-regex-spaces
      .replace(/^  \}\n\n\}/smg, '  }\n}')
      .replace(/\n\n\n+/smg, '\n\n')
      .trim();
  }

  async writeContent(file: string, content: string | string[]): Promise<void> {
    content = Array.isArray(content) ? content.join('') : content;

    await BinaryUtil.bufferedFileWrite(
      path.resolve(this.#output, this.subFolder, file),
      this.writeContentFilter(content),
      true
    );
  }

  registerContent(classId: string, content: RenderContent): void {
    this.#otherContent.set(classId, content);
  }

  async renderContent(file: string, content: RenderContent[]): Promise<void> {
    const output = path.resolve(this.#output, file.startsWith('.') ? this.subFolder : '.', file);
    const text: string[] = [];
    const imports: Record<string, string[]> = {};

    const seen = new Map<string, string>();

    for (const child of content.sort((a, b) => a.classId.localeCompare(b.classId))) {
      for (const sub of child.content) {
        if (typeof sub === 'string') {
          text.push(sub);
        } else {
          // Collision
          if (seen.has(sub.name) && seen.get(sub.name) !== sub.classId) {
            sub.name += `_${Util.uuid(4)}`;
          }
          if (!seen.has(sub.name)) {
            if (sub.file !== file) {
              (imports[sub.file] ??= []).push(sub.name);
            }
            seen.set(sub.name, sub.classId);
          }
          text.push(sub.name);
        }
      }
    }

    text.unshift(
      ...Object.entries(imports)
        .filter(x => !!x[0])
        .sort(([a], [b]) =>
          a.charAt(0) === b.charAt(0) ?
            a.localeCompare(b) :
            a.startsWith('.') ? 1 : a.localeCompare(b)
        )
        .map(([f, values]) => {
          if (values.join(', ').length > 60) {
            return `import {\n  ${values.sort().join(',\n  ')}\n} from '${f}';\n`;
          } else {
            return `import { ${values.sort().join(', ')} } from '${f}';\n`;
          }
        }),
      '\n\n',
    );

    await this.writeContent(output, text.join(''));
  }

  resolveType(type?: Class): string | Imp {
    if (type) {
      if (SchemaRegistry.has(type)) {
        return this.renderSchema(SchemaRegistry.get(type));
      } else {
        return TYPE_MAPPING.get(type) ?? 'unknown';
      }
    } else {
      return 'void';
    }
  }

  renderField(name: string, field: FieldConfig): RenderContent {
    const imports: Imp[] = [];

    const ident = `${name}${field.required?.active !== true ? '?' : ''}`;
    let type: string | Imp;
    if (SchemaRegistry.has(field.type)) {
      type = this.resolveType(field.type);
    } else if (field.specifiers?.includes('file')) {
      type = this.uploadType;
    } else if (field.match?.template) {
      type = recreateTemplateLiteral(field.match.template);
    } else if (field.enum) {
      type = `(${field.enum.values.map(v => typeof v === 'string' ? `'${v}'` : `${v}`).join(' | ')})`;
    } else {
      type = TYPE_MAPPING.get(field.type) ?? 'unknown';
    }
    if (typeof type !== 'string') {
      imports.push(type);
    }

    const content = [`${ident}: `, type, `${field.array ? '[]' : ''}`];
    return { classId: '_', file: '_', name: '', imports, content };
  }

  describeEndpoint(endpoint: EndpointConfig, controller: ControllerConfig): EndpointDesc {
    const imports: Imp[] = [];
    const paramSchemas = SchemaRegistry.getMethodSchema(controller.class, endpoint.handlerName);

    const paramsWithSchemas = endpoint.params
      .map((x, i) => ({ param: x, schema: paramSchemas[i] }))
      .filter(x => x.param.location !== 'context');

    const paramInputs = paramsWithSchemas.flatMap(({ param: ep, schema: x }) => {
      const rendered = this.renderField(ep.sourceText ?? ep.name!, x);
      imports.push(...rendered.imports);
      return [...rendered.content, ', '];
    });

    paramInputs.pop();

    const paramConfigs = paramsWithSchemas.map(({ param: x, schema: s }) => ({
      location: castTo<'body'>(x.location),
      name: x.name!,
      description: s.description,
      sourceText: x.sourceText,
      ...(x.prefix ? { prefix: x.prefix } : {}),
      ...(SchemaRegistry.has(s.type) ? { complex: true } : {}),
      ...(s.array ? { array: true } : {}),
      ...(s.specifiers?.includes('file') ? { binary: true } : {}),
    }));

    const resolvedReturn = this.resolveType(endpoint.responseType?.type);
    if (typeof resolvedReturn !== 'string') {
      imports.push(resolvedReturn);
    }

    const returnType = [resolvedReturn, endpoint.responseType?.array ? '[]' : ''];
    return { returnType, imports, paramInputs, paramConfigs };
  }

  buildSee(cls: Class, method?: string): string {
    const meta = describeFunction(cls);
    const lines = method ? meta?.methods?.[method].lines : meta?.lines;
    if (!lines) {
      return '';
    }
    const line = lines[0] ?? 1;
    const output = path.resolve(this.#output, this.subFolder || '.');
    return `@see file://./${path.relative(output, Runtime.getSourceFile(cls))}#${line}`;
  }

  renderDoc(parts: (string | undefined)[], pad = ''): string[] {
    parts = parts.filter(x => !!x);

    return parts.length === 0 ? [] : [
      '/**',
      ...parts.map(x => ` * ${x}`.trimEnd()),
      ' */'
    ].map(x => `${pad}${x}\n`);
  }

  renderControllerDoc(controller: ControllerConfig): string[] {
    return this.renderDoc([
      controller.description,
      this.buildSee(controller.class),
    ]);
  }

  renderEndpointDoc(endpoint: EndpointConfig, params: ParamConfig[]): string[] {
    const paramsDocs = params
      .filter(x => x.description)
      .map(x => `@param ${x.name} ${x.description}`);

    return this.renderDoc([
      endpoint.title,
      ((endpoint.title && endpoint.description) ? ' ' : ''),
      endpoint.description,
      (((endpoint.title || endpoint.description) && paramsDocs.length) ? ' ' : ''),
      ...paramsDocs,
      this.buildSee(endpoint.class, endpoint.handlerName)
    ], '  ');
  }

  renderEndpoint(endpoint: EndpointConfig, controller: ControllerConfig): { imports: Imp[], method: (string | Imp)[], config: (string | Imp)[] } {
    const { imports, paramInputs, paramConfigs, returnType } = this.describeEndpoint(endpoint, controller);
    const requestField = `#${endpoint.handlerName}Request`;
    const requestShape = JSON.stringify({
      method: endpoint.method === 'all' ? 'post' : endpoint.method,
      endpointPath: endpoint.path,
      paramConfigs
    }, null, 2)
      .replace(/^[  ]/gm, '   ')
      .replace(/^}/gm, '  }')
      .replace('"this"', 'this')
      .replaceAll('"', '\'')
      .replace(/'([^']+)':/gms, (_, v) => `${v}:`);

    const paramNames = paramConfigs.map(x => x.sourceText ?? x.name!);
    const paramArr = JSON.stringify(paramNames).replaceAll('"', '').replace(/,/g, ', ');

    imports.push(...[...this.endpointResponseWrapper].filter(x => typeof x !== 'string'));
    const opts: Imp = { name: 'RequestDefinition', file: './shared/types.ts', classId: '_common' };

    return {
      imports,
      method: [
        ...this.renderEndpointDoc(endpoint, paramConfigs),
        `  ${endpoint.handlerName}(`, ...paramInputs, '): ', ...this.endpointResponseWrapper, '<', ...returnType, '> {\n',
        '    return this.makeRequest<', ...returnType, `>(${paramArr}, this.${requestField});\n`,
        '  }\n\n',
      ],
      config: [`  ${requestField}: `, opts, ` = ${requestShape.trimEnd()};\n\n`,]
    };
  }

  renderSchema(schema: ClassConfig, force = false, visited = new Set<string>()): RenderContent {
    const classId = schema.class.Ⲑid;
    if (!force && this.#schemaContent.has(classId)) {
      return this.#schemaContent.get(classId)!;
    }

    let parent: Imp | undefined;
    visited.add(classId);
    const imports: Imp[] = [];

    if (schema.baseType) {
      // Render all children
      const children: RenderContent[] = [];
      for (const el of SchemaRegistry.getSubTypesForClass(schema.class) ?? []) {
        if (el !== schema.class && !visited.has(el.Ⲑid)) {
          children.push(this.renderSchema(SchemaRegistry.get(el), force, visited));
        }
      }
      const baseName = this.#nameResolver.getName(schema);
      const baseResult = {
        name: baseName,
        content: [`export type ${baseName} = ${children.map(x => x.name).join(' | ')};\n`],
        file: './schema.ts',
        imports: [],
        classId,
      };
      this.#schemaContent.set(classId, baseResult);
      this.#imports.add(Runtime.getImport(schema.class));
      return baseResult;
    }

    const fields: (string | Imp)[] = [];

    const parentFieldNames = new Set(
      parent ? SchemaRegistry.get(parent.classId).views[AllViewSymbol].fields : []
    );

    const view = schema.views[AllViewSymbol];
    for (const fieldName of view.fields) {
      if (!schema.subTypeName && parentFieldNames.has(fieldName)) {
        continue;
      }

      const field = view.schema[fieldName];
      const rendered = this.renderField(field.name, field);
      imports.push(...rendered.imports);

      fields.push(
        (field.title || field.description) ? `  /** ${field.title ?? ''}\n${field.description ?? ''} */\n` : '',
        '  ',
        ...rendered.content,
        ';\n'
      );
    }

    const name = this.#nameResolver.getName(schema);

    const result: RenderContent = {
      imports,
      classId,
      file: './schema.ts',
      name,
      content: [
        `export interface ${name}`,
        ...parent ? [' extends ', parent] : [], ' {\n',
        ...fields,
        '}\n',
      ]
    };

    this.#schemaContent.set(classId, result);
    this.#imports.add(Runtime.getImport(schema.class));

    return result;
  }

  async finalize(): Promise<void> {
    for (const [file, cls] of this.commonFiles) {
      await this.writeContent(file,
        await fs.readFile(typeof cls === 'string' ?
          cls : Runtime.getSourceFile(cls), 'utf8'));
    }

    const files = [
      ...this.#otherContent.values(),
      ...this.#schemaContent.values(),
      ...this.#controllerContent.values()
    ].reduce<Record<string, RenderContent[]>>((acc, x) => {
      (acc[x.file] ??= []).push(x);
      return acc;
    }, {});

    for (const [file, contents] of Object.entries(files)) {
      await this.renderContent(file, contents);
    }

    const content = Object.keys(files)
      .sort()
      .filter(f => !f.includes('.json'))
      .map(f => `export * from '${f}';\n`);

    await this.writeContent('index.ts', content);
  }

  async onComplete(): Promise<void> {
    await this.finalize();
  }

  onControllerEnd(cfg: ControllerConfig): void {
    if (cfg.documented !== false) {
      const result = this.renderController(cfg);
      this.#controllerContent.set(result.classId, result);
      this.#imports.add(Runtime.getImport(cfg.class));
    }
  }

  onControllerAdd(cls: Class): void {
    this.onControllerEnd(ControllerRegistry.get(cls));
  }

  onControllerRemove(cls: Class): void {
    this.#controllerContent.delete(cls.Ⲑid);
  }

  onSchemaAdd(cls: Class): boolean {
    if (this.#schemaContent.has(cls.Ⲑid)) {
      this.renderSchema(SchemaRegistry.get(cls), true);
      return true;
    }
    return false;
  }

  onSchemaRemove(cls: Class): boolean {
    return this.#schemaContent.delete(cls.Ⲑid);
  }

  seenImport(imp: string): boolean {
    return this.#imports.has(imp);
  }

  async render(): Promise<void> {
    return await ControllerVisitUtil.visit(this);
  }
}