import type { ManifestContext } from '../src/types';

declare namespace ManifestBootstrap {
  /**
   * Get Context for building
   */
  function getManifestContext(folder?: string): ManifestContext;
}

export = ManifestBootstrap;