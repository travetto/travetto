import { Readable } from 'stream';
import { AppError } from './error';
import { Class, ConcreteClass } from './types';

export type ResourceDescription = { size: number, path: string };

/**
 * Primary contract for resource handling
 */
export interface ResourceProvider {
  /**
   * Describe the resource
   * @param pth The path to resolve
   */
  describe(pth: string): Promise<ResourceDescription>;

  /**
   * Read a resource, mimicking fs.read
   * @param pth The path to read
   */
  read(pth: string, binary?: false): Promise<string>;
  read(pth: string, binary: true): Promise<Buffer>;
  read(pth: string, binary?: boolean): Promise<string | Buffer>;

  /**
   * Read a resource as a stream, mimicking fs.readStream
   * @param pth The path to read
   */
  readStream(pth: string, binary?: boolean): Promise<Readable>;
}

/**
 * Standard resource management interface allowing for look up by resource name
 */
class $ResourceManager implements ResourceProvider {

  #providersByScheme = new Map<string, ResourceProvider>();
  #providersById = new Map<string, ResourceProvider>();

  #resolvePath(pth: string): [ResourceProvider, string] {

    const { groups: { scheme, rel } = {} } = /^(?<scheme>[a-z]+)?:?[\/]*(?<rel>.*)/.exec(pth)!;
    const handler = this.#providersByScheme.get(scheme);
    if (!handler) {
      throw new AppError(`Unknown resource: ${pth}`, 'notfound');
    }
    return [handler, rel];
  }

  register(scheme: string, provider: ConcreteClass<ResourceProvider>): void {
    const inst = new provider();
    this.#providersByScheme.set(scheme, inst);
    this.#providersById.set(provider.Ⲑid, inst);
  }

  /**
   * Describe the resource
   * @param pth The path to resolve
   */
  describe(pth: string): Promise<ResourceDescription> {
    const [provider, rel] = this.#resolvePath(pth);
    return provider.describe(rel);
  }

  /**
   * Read resource as text
   * @param pth The path to read
   */
  read(pth: string, binary?: false): Promise<string>;
  read(pth: string, binary: true): Promise<Buffer>;
  read(pth: string, binary?: boolean): Promise<string | Buffer> {
    const [provider, rel] = this.#resolvePath(pth);
    return provider.read(rel, binary);
  }

  /**
   * Read a resource as a stream, mimicking fs.readStream
   * @param pth The path to read
   */
  readStream(pth: string, binary?: boolean): Promise<Readable> {
    const [provider, rel] = this.#resolvePath(pth);
    return provider.readStream(rel, binary);
  }

  /**
   * Retrieve specific provider by class
   */
  getProvider<T extends ResourceProvider>(cls: Class<T>): T {
    return this.#providersById.get(cls.Ⲑid) as T;
  }

  /**
   * Read resource as text
   * @param pth The path to read
   */
  async readJSON<T = unknown>(pth: string): Promise<T> {
    const [provider, rel] = this.#resolvePath(pth);
    return JSON.parse(await provider.read(rel)) as T;
  }
}

export const ResourceManager = new $ResourceManager();


export function ResourceProvider(scheme: string) {
  return <T extends ResourceProvider>(target: ConcreteClass<T>): void => {
    ResourceManager.register(scheme, target);
  };
}