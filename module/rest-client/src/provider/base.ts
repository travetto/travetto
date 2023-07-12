/* eslint-disable @typescript-eslint/quotes */
import fs from 'fs/promises';

import { Class, Util } from '@travetto/base';
import { ManifestUtil, RootIndex, path } from '@travetto/manifest';
import { ControllerConfig, ControllerRegistry, ControllerVisitor, EndpointConfig } from '@travetto/rest';
import { ClassConfig, FieldConfig, SchemaRegistry, TemplateLiteral } from '@travetto/schema';
import { AllViewⲐ } from '@travetto/schema/src/internal/types';

import { ParamConfig } from './shared/types';

export type Imp = { name: string, file: string, classId: string };

export const TYPE_MAPPING: Record<string, string> = {
  String: 'string',
  Number: 'number',
  Date: 'Date',
  Boolean: 'boolean',
  Object: 'object',
};

export type RenderContent = Imp & {
  imports: Imp[];
  content: (string | Imp)[];
};

type EndpointDesc = {
  returnType: (string | Imp)[];
  paramInputs: (string | Imp)[];
  paramConfigs: ParamConfig[];
  imports: Imp[];
};

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
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      out.push(`(${recreateTemplateLiteral(el as TemplateLiteral, true)})`);
    }
  }
  const body = (template.op === 'or') ? out.join('|') : out.join('');
  return escape ? `\`${body}\`` : body;
};

/**
 * Base functional skeleton for generating rest client artifacts
 */
export abstract class ClientGenerator<C = unknown> implements ControllerVisitor {

  #output: string;
  #files = new Map<string, RenderContent>();

  abstract get commonFiles(): [string, Class | string][];
  abstract get subFolder(): string;
  abstract get endpointResponseWrapper(): (string | Imp)[];
  abstract get outputExt(): '.js' | '.ts' | '';

  abstract renderController(cfg: ControllerConfig): RenderContent;

  moduleName: string;
  config: Partial<C> = {};

  constructor(output: string, moduleName?: string, config: Partial<C> = {}) {
    this.#output = output;
    this.moduleName = moduleName ?? `${RootIndex.mainModule.name}-client`;
    this.config = config;
    this.init?.();
  }

  init?(): void;

  get uploadType(): string | Imp { return '(File | Blob)'; }

  writeContentFilter(text: string): string {
    return text.trim()
      .replace(/^((?:ex|im)port\s+[^;]*\s+from\s*[^;]+)';$/gsm, (_, x) => `${x.replace(/[.]ts$/, '')}${this.outputExt}';`)
      .replaceAll(/^(.*)#REMOVE.*$/mg, _ => '');
  }

  async writeContent(file: string, content: string | string[]): Promise<void> {
    content = Array.isArray(content) ? content.join('') : content;
    await ManifestUtil.writeFileWithBuffer(
      path.resolve(this.#output, this.subFolder, file),
      this.writeContentFilter(content)
    );
  }

  registerContent(classId: string, content: RenderContent): void {
    this.#files.set(classId, content);
  }

  async renderContent(file: string, content: RenderContent[]): Promise<void> {
    const output = path.resolve(this.#output, file.startsWith('.') ? this.subFolder : '.', file);
    const text: string[] = [];
    const imports: Record<string, string[]> = {};

    const seen = new Map<string, string>();

    for (const child of content) {
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
        .map(([f, vals]) => {
          if (vals.join(', ').length > 60) {
            return `import {\n  ${vals.join(',\n  ')}\n} from '${f}';\n`;
          } else {
            return `import { ${vals.join(', ')} } from '${f}';\n`;
          }
        }),
      '\n\n',
    );

    await this.writeContent(output,
      text.join('').replace(/^  \}\n\n\}/smg, '  }\n}')
    );
  }

  resolveType(type?: Class): string | Imp {
    if (type) {
      if (SchemaRegistry.has(type)) {
        return this.renderSchema(SchemaRegistry.get(type));
      } else {
        return TYPE_MAPPING[type.name];
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
      type = this.renderSchema(SchemaRegistry.get(field.type));
    } else if (field.specifiers?.includes('file')) {
      type = this.uploadType;
    } else {
      if (field.match?.template) {
        type = recreateTemplateLiteral(field.match.template);
      } else if (field.enum) {
        type = `(${field.enum.values.map(v => typeof v === 'string' ? `'${v}'` : `${v}`).join(' | ')})`;
      } else {
        type = TYPE_MAPPING[field.type.name] ?? 'unknown';
      }
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
      const rendered = this.renderField(ep.name!, x);
      imports.push(...rendered.imports);
      return [...rendered.content, ', '];
    });

    paramInputs.pop();

    const paramConfigs = paramsWithSchemas.map(({ param: x, schema: s }) => ({
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      location: x.location as 'body',
      name: x.name!,
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
      .replace('"this"', `this`)
      .replaceAll('"', `'`)
      .replace(/'([^']+)':/gms, (_, v) => `${v}:`)

    const paramNames = paramConfigs.map(x => x.name!);
    const paramNameArr = JSON.stringify(paramNames).replaceAll(`"`, '').replace(/,/g, ', ');

    imports.push(...[...this.endpointResponseWrapper].filter((x): x is Imp => typeof x !== 'string'));
    const opts: Imp = { name: 'RequestDefinition', file: './shared/types.ts', classId: '_common' };

    return {
      imports,
      method: [
        endpoint.title ? `  /**\n   * ${endpoint.title}\n   * ${endpoint.description ?? ''}\n   */\n` : '',
        `  ${endpoint.handlerName}(`, ...paramInputs, `): `, ...this.endpointResponseWrapper, `<`, ...returnType, `> {\n`,
        `    return this.makeRequest<`, ...returnType, `>(${paramNameArr}, this.${requestField});\n`,
        `  }\n\n`,
      ],
      config: [`  ${requestField}: `, opts, ` = ${requestShape.trimEnd()};\n\n`,]
    };
  }

  renderSchema(schema: ClassConfig, visited = new Set<string>()): RenderContent {
    let parent: Imp | undefined;
    visited.add(schema.class.Ⲑid);
    const imports: Imp[] = [];

    if (schema.subTypeName) { // There is a base type
      const base = SchemaRegistry.getBaseSchema(schema.class);
      const parentSchema = SchemaRegistry.get(base);
      if (parentSchema.class !== schema.class) {
        parent = this.renderSchema(parentSchema, visited);
        imports.push(parent);
      }
    }
    if (schema.baseType) {
      // Render all children
      for (const el of SchemaRegistry.getSubTypesForClass(schema.class) ?? []) {
        if (el !== schema.class && !visited.has(el.Ⲑid)) {
          this.renderSchema(SchemaRegistry.get(el), visited);
        }
      }
    }

    const fields: (string | Imp)[] = [];

    const parentFieldNames = new Set(
      parent ? SchemaRegistry.get(parent.classId).views[AllViewⲐ].fields : []
    );

    const view = schema.views[AllViewⲐ];
    for (const fieldName of view.fields) {
      if (parentFieldNames.has(fieldName)) {
        continue;
      }

      const field = view.schema[fieldName];
      const rendered = this.renderField(field.name, field);
      imports.push(...rendered.imports);

      fields.push(
        (field.title || field.description) ? `  /** ${field.title ?? ''}\n${field.description ?? ''} */\n` : '',
        `  `,
        ...rendered.content,
        `;\n`
      );
    }

    const result: RenderContent = {
      imports,
      classId: schema.class.Ⲑid,
      file: './schema.ts',
      name: schema.externalName,
      content: [
        `export interface ${schema.externalName}`,
        ...parent ? [' extends ', parent] : [], `{\n`,
        ...fields,
        `}\n`,
      ]
    };

    this.#files.set(schema.class.Ⲑid, result);

    return result;
  }

  async finalize(): Promise<void> {
    for (const [file, cls] of this.commonFiles) {
      await this.writeContent(file, await fs.readFile(typeof cls === 'string' ? cls : RootIndex.getFunctionMetadata(cls)!.source, 'utf8'));
    }

    const files = [...this.#files.values()].reduce<Record<string, RenderContent[]>>((acc, x) => {
      (acc[x.file] ??= []).push(x);
      return acc;
    }, {});

    for (const [file, contents] of Object.entries(files)) {
      await this.renderContent(file, contents);
    }
    await this.writeContent(
      'index.ts',
      Object.keys(files)
        .filter(f => !f.includes('.json'))
        .map(f => `export * from '${f}';\n`)
    );
  }

  async onComplete(): Promise<void> {
    await this.finalize();
  }

  onControllerEnd(cfg: ControllerConfig): void {
    const result = this.renderController(cfg);
    this.#files.set(result.classId, result);
  }

  onControllerAdd(cls: Class): void {
    const result = this.renderController(ControllerRegistry.get(cls));
    this.#files.set(result.classId, result);
  }

  onControllerRemove(cls: Class): void {
    this.#files.delete(cls.Ⲑid);
  }

  onSchemaAdd(cls: Class): boolean {
    if (this.#files.has(cls.Ⲑid)) {
      this.renderSchema(SchemaRegistry.get(cls));
      return true;
    }
    return false;
  }

  onSchemaRemove(cls: Class): boolean {
    if (this.#files.has(cls.Ⲑid)) {
      this.#files.delete(cls.Ⲑid);
      return true;
    }
    return false;
  }
}