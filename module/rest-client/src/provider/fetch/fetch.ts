/* eslint-disable @typescript-eslint/quotes */
import fs from 'fs/promises';

import { Class, Util } from '@travetto/base';
import { ManifestUtil, RootIndex, path } from '@travetto/manifest';
import { ControllerConfig, ControllerRegistry, ControllerVisitor, EndpointConfig } from '@travetto/rest';
import { ClassConfig, SchemaRegistry } from '@travetto/schema';
import { AllViewⲐ } from '@travetto/schema/src/internal/types';

import { BaseService } from './base-service';

type Imp = { name: string, file: string, classId: string };

const TYPE_MAPPING: Record<string, string> = {
  String: 'string',
  Number: 'number',
  Date: 'Date',
  Boolean: 'boolean'
};

type RenderContent = Imp & {
  imports: Imp[];
  content: (string | Imp)[];
};

export class FetchClientGenerator implements ControllerVisitor {

  #output: string;
  #controllers = new Map<string, RenderContent>();
  #schema = new Map<string, RenderContent>();

  constructor(output: string) {
    this.#output = output;
  }

  async #renderContent(file: string, content: RenderContent[]): Promise<void> {
    const output = path.resolve(this.#output, file);
    const text: string[] = [];

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
          seen.set(sub.name, sub.classId);
          text.push(sub.name);
        }
      }
    }

    await ManifestUtil.writeFileWithBuffer(output, text.join(''));
  }

  renderSchema(schema: ClassConfig): RenderContent {
    let parent: Imp | undefined;
    const imports: Imp[] = [];

    if (schema.subTypeName) { // There is a base type
      const base = SchemaRegistry.getBaseSchema(schema.class);
      parent = this.renderSchema(SchemaRegistry.get(base));
      imports.push(parent);
    }

    const fields: (string | Imp)[] = [];

    const view = schema.views[AllViewⲐ];
    for (const fieldName of view.fields) {
      const field = view.schema[fieldName];
      let type: string | Imp;

      if (SchemaRegistry.has(field.type)) {
        const imported = this.renderSchema(SchemaRegistry.get(field.type));
        imports.push(imported);
        type = imported;
      } else {
        const resolved = TYPE_MAPPING[field.type.name];
        if (field.enum) {
          type = `(${field.enum.values.map(v => typeof v === 'string' ? `'${v}'` : `${v}`).join(' | ')})`;
        } else {
          type = resolved;
        }
      }
      fields.push(
        `  /** ${field.description} */\n`,
        `  ${fieldName}${field.required?.active !== true ? '?' : ''}: `, type, `${field.array ? '[]' : ''};\n`
      );
    }

    const result: RenderContent = {
      imports,
      classId: schema.class.Ⲑid,
      file: 'schema.ts',
      name: schema.class.name,
      content: [
        `export class ${schema.class.name}`,
        ...parent ? [' extends ', parent] : [], `{\n`,
        ...fields,
        `}\n`,
      ]
    };

    this.#schema.set(schema.class.Ⲑid, result);

    return result;
  }

  renderEndpoint(endpoint: EndpointConfig, controller: ControllerConfig): RenderContent {
    const out: (string | Imp)[] = [];
    const imports: Imp[] = [];

    const resolveType = (type?: Class): string | Imp => {
      if (type) {
        const imp = this.renderSchema(SchemaRegistry.get(type));
        imports.push(imp);
        return imp;
      } else {
        return 'void';
      }
    };

    const params = SchemaRegistry.getMethodSchema(controller.class, endpoint.method);

    const paramParams = params
      .filter(x => endpoint.params.find(y => x.name === y.name && y.location !== 'context'))
      .flatMap(x => {
        const ident = `${x.name}${x.required?.active !== true ? '?' : ''}`;
        if (SchemaRegistry.get(x.type)) {
          return [`${ident}: `, resolveType(x.type), `${x.array ? '[]' : ''}\n`];
        } else {
          return [`${ident}: ${TYPE_MAPPING[x.type.name] ?? 'unknown'}${x.array ? '[]' : ''}\n`];
        }
      });

    const paramConfig = endpoint.params.filter(x => x.location !== 'context').map(x => ({ location: x.location, name: x.name }));

    out.push(
      `  ${endpoint.handlerName} (\n`,
      ...paramParams,
      `  ): Promise < ${resolveType(endpoint.responseType?.type)}> {\n`,
      `    const params = ${JSON.stringify(paramConfig)};\n`,
      `    return this.${endpoint.method} ([${params.map(x => x.name).join(', ')}], params);\n`,
      `  }\n`,
    );

    return {
      imports,
      classId: '',
      name: endpoint.handlerName,
      file: '',
      content: out
    };
  }

  onControllerEnd(controller: ControllerConfig): void {
    const service = controller.class.name.replace(/(Controller|Rest|Service)$/, '');

    const endpoints = controller.endpoints;

    const results = endpoints.map(x => this.renderEndpoint(x, controller));

    const contents = [
      `import { BaseService } from './base-service'; `,
      `export class ${service}Service extends BaseService {`,
      ...results.flatMap(f => f.content),
      `} `
    ];

    const result: RenderContent = {
      file: 'api.ts',
      classId: controller.class.Ⲑid,
      name: service,
      content: contents,
      imports: results.flatMap(x => x.imports)
    };

    this.#controllers.set(controller.class.Ⲑid, result);
  }

  async finalize(): Promise<void> {
    const base = path.resolve(this.#output, 'base-service');
    if (!(await fs.stat(base).catch(() => false))) {
      const baseSource = RootIndex.getFunctionMetadata(BaseService)!.source;
      await fs.copyFile(baseSource, base);
    }

    await this.#renderContent('api.ts', [...this.#controllers.values()]);
    await this.#renderContent('schema.ts', [...this.#schema.values()]);
    await ManifestUtil.writeFileWithBuffer(path.join(this.#output, '__index__.ts'), [
      `export * from './api';\n`,
      `export * from './schema';\n`
    ].join(''));
  }


  async onComplete(): Promise<void> {
    await this.finalize();
  }

  onControllerAdd(cls: Class): void {
    this.onControllerEnd(ControllerRegistry.get(cls));
  }

  onControllerRemove(cls: Class): void {
    this.#controllers.delete(cls.Ⲑid);
  }

  onSchemaChange(cls: Class): boolean {
    if (this.#schema.has(cls.Ⲑid)) {
      this.renderSchema(SchemaRegistry.get(cls));
      return true;
    }
    return false;
  }

  onSchemaRemove(cls: Class): boolean {
    if (this.#schema.has(cls.Ⲑid)) {
      this.#schema.delete(cls.Ⲑid);
      return true;
    }
    return false;
  }
}