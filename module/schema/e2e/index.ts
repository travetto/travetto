import { PhaseManager } from '@travetto/base';

export async function main() {
  await PhaseManager.run('init');

  await import('./watch');
  const { SchemaRegistry } = await import('..');

  SchemaRegistry.onFieldChange((e) => {
    console.log('Field', { changes: e.changes.length, target: e.cls.ᚕid });
  });
  SchemaRegistry.onSchemaChange((e) => {
    console.log('Schema', { type: e.change.config, target: e.cls.ᚕid });
  });
}