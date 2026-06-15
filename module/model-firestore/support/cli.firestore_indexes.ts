import { type CliCommandShape, CliCommand, CliModuleFlag } from '@travetto/cli';
import { JSONUtil, Env } from '@travetto/runtime';
import { Registry } from '@travetto/registry';
import { DependencyRegistryIndex } from '@travetto/di';
import { ModelRegistryIndex } from '@travetto/model';
import { isModelIndexedIndex } from '@travetto/model-indexed';
import { ManifestFileUtil, ManifestUtil } from '@travetto/manifest';

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

    const indexesList: FirestoreIndexDefinition[] = [];

    for (const cls of ModelRegistryIndex.getClasses()) {
      const indices = ModelRegistryIndex.getIndices(cls)
        .filter(isModelIndexedIndex)
        // We need at least 2 fields.  All 1 field indices are already handled
        .filter((idx => (idx.keyTemplate?.length ?? 0) + (idx.sortTemplate?.length ?? 0) >= 2));

      for (const idx of indices) {
        indexesList.push({
          collectionGroup: FirestoreModelService.resolveTable(cls, config.namespace),
          queryScope: 'COLLECTION',
          fields: [...idx.keyTemplate, ...idx.sortTemplate]
            .map(part => ({ fieldPath: part.path.join('.'), order: part.value === -1 ? 'DESCENDING' : 'ASCENDING' }))
        });
      }
    }

    const outputData: FirestoreIndexSet = {
      indexes: indexesList,
      fieldOverrides: []
    };

    const text = JSONUtil.toUTF8Pretty(outputData);

    if (this.output === '-' || !this.output) {
      console.log!(text);
    } else {
      await ManifestFileUtil.bufferedFileWrite(this.output, text);
    }
  }
}
