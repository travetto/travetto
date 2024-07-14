import type { ManifestContext } from '../src/types/context';

declare namespace ManifestBootstrap {
  /**
   * Get Context for building
   */
  function getManifestContext(folder?: string): ManifestContext;
}

export = ManifestBootstrap;