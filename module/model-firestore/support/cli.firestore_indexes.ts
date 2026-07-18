import cp from 'node:child_process';
import fs from 'node:fs/promises';

import { CliCommand, type CliCommandShape, CliModuleFlag } from '@travetto/cli';
import { DependencyRegistryIndex } from '@travetto/di';
import { ManifestFileUtil } from '@travetto/manifest';
import { ModelRegistryIndex } from '@travetto/model';
import { isModelIndexedIndex } from '@travetto/model-indexed';
import { Registry } from '@travetto/registry';
import { Env, ExecUtil, JSONUtil, Runtime } from '@travetto/runtime';

import { FirestoreModelConfig } from '../src/config.ts';
import { FirestoreModelService } from '../src/service.ts';

type FirestoreIndexField = {
  fieldPath: string;
  order: 'ASCENDING' | 'DESCENDING';
};

type FirestoreIndexDefinition = {
  collectionGroup: string;
  queryScope: 'COLLECTION' | 'COLLECTION_GROUP';
  fields: FirestoreIndexField[];
};

type FirestoreIndexSet = {
  indexes: FirestoreIndexDefinition[];
  fieldOverrides: unknown[];
};

/**
 * Generate the Firestore composite indexes JSON for all registered models.
 *
 * The resulting JSON can be written to stdout or to a file path for use in
 * firebase-cli deployments.
 */
@CliCommand()
export class FirestoreIndexesCommand implements CliCommandShape {
  indexFile = 'firestore.indexes.json';
  firebaseFile = 'firebase.json';

  @CliModuleFlag({ short: 'm' })
  module: string;

  /** Should we deploy after writing the json file? */
  deploy?: boolean;

  finalize(): void {
    Env.DEBUG.set(false);
  }

  async main(): Promise<void> {
    await Registry.init();

    const config = await DependencyRegistryIndex.getInstance(FirestoreModelConfig);

    const indexesList: FirestoreIndexDefinition[] = [];

    for (const cls of ModelRegistryIndex.getClasses()) {
      const indices = ModelRegistryIndex.getIndices(cls)
        .filter(isModelIndexedIndex)
        // We need at least 2 fields.  All 1 field indices are already handled
        .filter(idx => (idx.keyTemplate?.length ?? 0) + (idx.sortTemplate?.length ?? 0) >= 2);

      for (const idx of indices) {
        indexesList.push({
          collectionGroup: FirestoreModelService.resolveTable(cls, config.namespace),
          queryScope: 'COLLECTION',
          fields: [...idx.keyTemplate, ...idx.sortTemplate].map(part => ({
            fieldPath: part.path.join('.'),
            order: part.value === -1 ? 'DESCENDING' : 'ASCENDING'
          }))
        });
      }
    }

    const outputData: FirestoreIndexSet = {
      indexes: indexesList,
      fieldOverrides: []
    };

    const text = JSONUtil.toUTF8Pretty(outputData);

    await ManifestFileUtil.bufferedFileWrite(this.indexFile, text);

    const firebaseLocation = Runtime.workspaceRelative(this.firebaseFile);
    if (!(await fs.stat(firebaseLocation, { throwIfNoEntry: false }))) {
      await ManifestFileUtil.bufferedFileWrite(firebaseLocation, '{}');
    }

    const firebaseContext = JSONUtil.fromBinaryArray<{ firestore?: { database?: string; indexes?: string }[] }>(
      await fs.readFile(firebaseLocation)
    );
    const existing = (firebaseContext.firestore ??= []);
    const found = existing.find(x => x.database === config.databaseId);

    let changed = true;
    if (!found) {
      existing.push({ indexes: this.indexFile, database: config.databaseId });
    } else if (found.indexes !== this.indexFile) {
      found.indexes = this.indexFile;
    } else {
      changed = false;
    }

    if (changed) {
      await ManifestFileUtil.bufferedFileWrite(firebaseLocation, JSONUtil.toUTF8Pretty(firebaseContext));
    }

    if (this.deploy) {
      const child = cp.spawn(
        'firebase',
        ['deploy', '--only', 'firestore:indexes'],
        // Complete take over
        { stdio: 'inherit' }
      );
      await ExecUtil.getResult(child);
    }
  }
}
