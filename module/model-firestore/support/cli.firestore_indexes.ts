import fs from 'node:fs/promises';
import path from 'node:path';

import { type CliCommandShape, CliCommand, CliModuleFlag } from '@travetto/cli';
import { JSONUtil, Env } from '@travetto/runtime';
import { Registry } from '@travetto/registry';
import { DependencyRegistryIndex } from '@travetto/di';
import { ModelRegistryIndex } from '@travetto/model';
import { isModelIndexedIndex } from '@travetto/model-indexed';

import { FirestoreModelConfig } from '../src/config.ts';

/**
 * Generate the Firestore composite indexes JSON for all registered models.
 *
 * The resulting JSON can be written to stdout or to a file path for use in
 * firebase-cli deployments.
 */
@CliCommand()
export class FirestoreIndexesCommand implements CliCommandShape {

  /** Output file */
  output?: string;

  @CliModuleFlag({ short: 'm' })
  module: string;

  finalize(): void {
    Env.DEBUG.set(false);
  }

  async main(): Promise<void> {
    await Registry.init();

    const config = await DependencyRegistryIndex.getInstance(FirestoreModelConfig);

    const indexesList: unknown[] = [];

    for (const cls of ModelRegistryIndex.getClasses()) {
      let collectionGroup = ModelRegistryIndex.getStoreName(cls);
      if (config.namespace) {
        collectionGroup = `${config.namespace}_${collectionGroup}`;
      }

      const indices = ModelRegistryIndex.getIndices(cls);
      for (const idx of indices) {
        if (isModelIndexedIndex(idx)) {
          const fieldsCount = (idx.keyTemplate?.length ?? 0) + (idx.sortTemplate?.length ?? 0);
          // Only create composite indexes if we have at least 2 fields
          if (fieldsCount >= 2) {
            const fields: { fieldPath: string, order: 'ASCENDING' | 'DESCENDING' }[] = [];

            // Add key fields first
            for (const part of idx.keyTemplate) {
              fields.push({
                fieldPath: part.path.join('.'),
                order: 'ASCENDING'
              });
            }

            // Add sort fields second
            for (const part of idx.sortTemplate) {
              fields.push({
                fieldPath: part.path.join('.'),
                order: part.value === 1 ? 'ASCENDING' : 'DESCENDING'
              });
            }

            indexesList.push({
              collectionGroup,
              queryScope: 'COLLECTION',
              fields
            });
          }
        }
      }
    }

    const outputData = {
      indexes: indexesList,
      fieldOverrides: []
    };

    const text = JSONUtil.toUTF8Pretty(outputData);

    if (this.output === '-' || !this.output) {
      console.log!(text);
    } else {
      await fs.mkdir(path.dirname(this.output), { recursive: true });
      await fs.writeFile(this.output, text, 'utf8');
    }
  }
}
