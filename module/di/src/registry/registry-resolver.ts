import { SchemaRegistryIndex } from '@travetto/schema';
import { castTo, type Class } from '@travetto/runtime';

import { getDefaultQualifier, type InjectableCandidate, PrimaryCandidateSymbol, type ResolutionType } from '../types.ts';
import { InjectionError } from '../error.ts';

type Resolved<T> = { candidate: InjectableCandidate<T>, qualifier: symbol, target: Class };

function setInMap<T>(map: Map<Class, Map<typeof key, T>>, cls: Class, key: symbol | string, dest: T): void {
  map.getOrInsert(cls, new Map()).set(key, dest);
}

export class DependencyRegistryResolver {
  /**
   * Default symbols
   */
  #defaultSymbols = new Set<symbol>();

  /**
   * Maps from the requested type to the candidates
   */
  #byCandidateType = new Map<Class, Map<symbol, InjectableCandidate>>();

  /**
   * Maps from inbound class file) to the candidates
   */
  #byContainerType = new Map<Class, Map<symbol, InjectableCandidate>>();

  #resolveQualifier<T>(type: Class<T>, resolution?: ResolutionType): symbol | undefined {
    const qualifiers = this.#byCandidateType.get(type) ?? new Map<symbol, InjectableCandidate>();

    const resolved = [...qualifiers.keys()];

    // If primary found
    if (qualifiers.has(PrimaryCandidateSymbol)) {
      return PrimaryCandidateSymbol;
    } else {
      const filtered = resolved
        .filter(qualifier => !!qualifier)
        .filter(qualifier => this.#defaultSymbols.has(qualifier));
      // If there is only one default symbol
      if (filtered.length === 1) {
        return filtered[0];
      } else if (filtered.length > 1) {
        // If dealing with sub types, prioritize exact matches
        const exact = this.getCandidateEntries(type)
          .map(([_, candidate]) => candidate)
          .filter(candidate => candidate.candidateType === type);

        if (exact.length === 1) {
          return exact[0].qualifier;
        } else {
          if (resolution === 'any') {
            return filtered[0];
          } else {
            throw new InjectionError('Dependency has multiple candidates', type, filtered);
          }
        }
      }
    }
  }

  /**
   * Register a class with the dependency resolver
   */
  registerClass(config: InjectableCandidate, baseParent?: Class): void {
    const candidateType = config.candidateType;
    const target = config.target ?? candidateType;

    const isSelfTarget = target === candidateType;
    const qualifier = config.qualifier ?? getDefaultQualifier(candidateType);

    // Record qualifier if its the default for the class
    if (config.qualifier === getDefaultQualifier(candidateType)) {
      this.#defaultSymbols.add(config.qualifier);
    }

    // Register inbound config by method and class
    setInMap(this.#byContainerType, config.class, config.method, config);

    setInMap(this.#byCandidateType, target, qualifier, config);
    setInMap(this.#byCandidateType, candidateType, qualifier, config);

    // Track interface aliases as targets
    const interfaces = SchemaRegistryIndex.has(candidateType) ?
      SchemaRegistryIndex.get(candidateType).get().interfaces : [];

    for (const type of interfaces) {
      setInMap(this.#byCandidateType, type, qualifier, config);
    }

    // If targeting self (default @Injectable behavior)
    if (isSelfTarget && baseParent) {
      setInMap(this.#byCandidateType, baseParent, qualifier, config);
    }

    // Registry primary candidates
    if (config.primary) {
      if (baseParent) {
        setInMap(this.#byCandidateType, baseParent, PrimaryCandidateSymbol, config);
      }

      // Register primary for self
      setInMap(this.#byCandidateType, target, PrimaryCandidateSymbol, config);

      // Register primary if only one interface provided and no parent config
      if (interfaces.length === 1 && (!baseParent || !this.#byContainerType.has(baseParent))) {
        const [primaryInterface] = interfaces;
        setInMap(this.#byCandidateType, primaryInterface, PrimaryCandidateSymbol, config);
      } else if (isSelfTarget) {
        // Register primary for all interfaces if self targeting
        for (const type of interfaces) {
          setInMap(this.#byCandidateType, type, PrimaryCandidateSymbol, config);
        }
      }
    }
  }

  /**
   * Resolve the target given a qualifier
   * @param candidateType
   * @param qualifier
   */
  resolveCandidate<T>(candidateType: Class<T>, qualifier?: symbol, resolution?: ResolutionType): Resolved<T> {
    const qualifiers = this.#byCandidateType.get(candidateType) ?? new Map<symbol, InjectableCandidate>();

    let config: InjectableCandidate;

    if (qualifier && qualifiers.has(qualifier)) {
      config = qualifiers.get(qualifier)!;
    } else {
      qualifier ??= this.#resolveQualifier(candidateType, resolution);

      if (!qualifier) {
        throw new InjectionError('Dependency not found', candidateType);
      } else if (!qualifiers.has(qualifier)) {
        if (!this.#defaultSymbols.has(qualifier) && resolution === 'loose') {
          console.debug('Unable to find specific dependency, falling back to general instance', { qualifier, target: candidateType.Ⲑid });
          return this.resolveCandidate(candidateType);
        }
        throw new InjectionError('Dependency not found', candidateType, [qualifier]);
      } else {
        config = qualifiers.get(qualifier!)!;
      }
    }

    return {
      candidate: castTo(config),
      qualifier,
      target: (config.target ?? config.candidateType)
    };
  }

  removeClass(cls: Class, qualifier: symbol): void {
    this.#defaultSymbols.delete(qualifier);
    this.#byCandidateType.get(cls)!.delete(qualifier);
    this.#byContainerType.get(cls)!.delete(qualifier);
  }

  getCandidateEntries(candidateType: Class): [symbol, InjectableCandidate][] {
    return [...this.#byCandidateType.get(candidateType)?.entries() ?? []];
  }

  getContainerEntries(containerType: Class): [symbol, InjectableCandidate][] {
    return [...this.#byContainerType.get(containerType)?.entries() ?? []];
  }
}