/* eslint-disable @typescript-eslint/quotes */
import fs from 'fs/promises';

import { Class, Util } from '@travetto/base';
import { ManifestUtil, RootIndex, path } from '@travetto/manifest';
import { ControllerConfig, ControllerRegistry, ControllerVisitor, EndpointConfig } from '@travetto/rest';
import { ClassConfig, FieldConfig, SchemaRegistry } from '@travetto/schema';
import { AllViewⲐ } from '@travetto/schema/src/internal/types';

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
  method: string;
  returnType: (string | Imp)[];
  paramInputs: (string | Imp)[];
  paramConfigField: string;
  paramNameArr: string;
  imports: Imp[];
  paramConfig: string;
  doc: string;
};

export abstract class ClientGenerator implements ControllerVisitor {

  #output: string;
  #files = new Map<string, RenderContent>();

  abstract get commonFiles(): [string, Class][];

  abstract renderController(cfg: ControllerConfig): RenderContent;

  constructor(output: string) {
    this.#output = output;
    this.init?.();
  }

  init?(): void;

  registerContent(file: string, content: RenderContent): void {
    this.#files.set(file, content);
  }

  async renderContent(file: string, content: RenderContent[]): Promise<void> {
    const output = path.resolve(this.#output, file);
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
        .map(([f, vals]) => `import { ${vals.join(', ')} } from '${f.replace(/[.]ts$/, '')}';\n`),
      '\n\n',
    );

    if (!text.length) {
      text.push(`export const __placeholder__${file.replace(/[^A-Z]/gi, '_')} = {};\n`);
    }

    await ManifestUtil.writeFileWithBuffer(output, text.join(''));
  }

  resolveType(type?: Class): string | Imp {
    if (type) {
      if (SchemaRegistry.has(type)) {
        return this.renderSchema(SchemaRegistry.get(type));
      } else {
        return 'void';
      }
    } else {
      return 'void';
    }
  }

  abstract getUploadType(): string | Imp;

  renderField(name: string, field: FieldConfig): RenderContent {
    const imports: Imp[] = [];

    const ident = `${name}${field.required?.active !== true ? '?' : ''}`;
    let type: string | Imp;
    if (SchemaRegistry.has(field.type)) {
      type = this.renderSchema(SchemaRegistry.get(field.type));
    } else if (field.specifiers?.includes('file')) {
      type = this.getUploadType();
    } else {
      if (field.enum) {
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
      return [`    `, ...rendered.content, ',\n'];
    });

    const paramNames = paramsWithSchemas.map(x => x.param.name!);
    const paramConfig = paramsWithSchemas.map(({ param: x, schema: s }) => ({
      location: x.location,
      name: x.name,
      ...(SchemaRegistry.has(s.type) ? { complex: true } : {}),
      ...(s.array ? { array: true } : {}),
      ...(s.specifiers?.includes('file') ? { binary: true } : {}),
    }));

    const resolvedReturn = this.resolveType(endpoint.responseType?.type);
    if (typeof resolvedReturn !== 'string') {
      imports.push(resolvedReturn);
    }

    const returnType = [
      resolvedReturn,
      endpoint.responseType?.array ? '[]' : ''
    ];
    const method = endpoint.method === 'all' ? 'GET' : endpoint.method.toUpperCase();
    const paramNameArr = JSON.stringify(paramNames).replaceAll(`"`, '');
    const paramConfigField = `#${endpoint.handlerName}Params`;

    const doc = endpoint.title ? `  /** ${endpoint.title}\n${endpoint.description ?? ''}*/\n` : '';

    return {
      doc,
      method,
      returnType,
      imports,
      paramNameArr,
      paramConfigField,
      paramInputs,
      paramConfig: JSON.stringify(paramConfig)
        .replaceAll('"', `'`)
        .replace(/'([^']+)':/gms, (_, v) => `${v}:`)
        .replace(/(\[|(?:\},?))/g, _ => `${_}\n`)
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

    const cleaned = schema.class.name.replace(/Ⲑsyn/, '');

    const result: RenderContent = {
      imports,
      classId: schema.class.Ⲑid,
      file: './schema.ts',
      name: cleaned,
      content: [
        `export interface ${cleaned}`,
        ...parent ? [' extends ', parent] : [], `{\n`,
        ...fields,
        `}\n`,
      ]
    };

    this.#files.set(schema.class.Ⲑid, result);

    return result;
  }

  async finalize(): Promise<void> {
    await fs.mkdir(this.#output, { recursive: true });
    for (const [file, cls] of this.commonFiles) {
      const base = path.resolve(this.#output, file);
      if (!(await fs.stat(base).catch(() => false))) {
        const baseSource = RootIndex.getFunctionMetadata(cls)!.source;
        await fs.copyFile(baseSource, base);
      }
    }

    const files = [...this.#files.values()].reduce<Record<string, RenderContent[]>>((acc, x) => {
      (acc[x.file] ??= []).push(x);
      return acc;
    }, {});

    for (const [file, contents] of Object.entries(files)) {
      await this.renderContent(file, contents);
    }
    await ManifestUtil.writeFileWithBuffer(path.join(this.#output, 'index.ts'), [
      ...[...Object.keys(files)].map(f =>
        `export * from '${f.replace(/[.]ts$/, '')}';\n`
      ),
    ].join(''));
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