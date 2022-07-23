import { PhaseManager } from '@travetto/base';

export async function main(): Promise<void> {
  await PhaseManager.run('init');

  await import('./watch');
  const { SchemaChangeListener } = await import('..');

  SchemaChangeListener.onFieldChange((e) => {
    console.log('Field', { changes: e.changes.length, target: e.cls.ᚕid });
  });
  SchemaChangeListener.onSchemaChange((e) => {
    console.log('Schema', { type: e.change.config, target: e.cls.ᚕid });
  });
}