import { FileResourceProvider } from '@travetto/base';

/**
 * Presets utility for openapi client command
 */
export class OpenApiClientPresets {

  static #presets: Record<string, [string, object] | [string]>;
  static #resources = new FileResourceProvider(['@travetto/openapi#support/resources']);

  static async getPresets(): Promise<Record<string, [string, object] | [string]>> {
    if (!this.#presets) {
      const text = await this.#resources.read('presets.json');
      this.#presets = JSON.parse(text);
    }
    return this.#presets;
  }

  static presetMap(prop?: object): string {
    return !prop || Object.keys(prop).length === 0 ? '' : Object.entries(prop).map(([k, v]) => `${k}=${v}`).join(',');
  }
}