import { SchemaRegistryIndex } from '@travetto/schema';
import { castTo, Class } from '@travetto/runtime';

import { DependencyClassId, PrimaryCandidateSymbol, Resolved } from './types';
import { ClassTarget, getDefaultQualifier, InjectableCandidateConfig, ResolutionType } from '../types';
import { InjectionError } from '../error';

function setInMap<T>(map: Map<string, Map<typeof key, T>>, src: string, key: symbol | string, dest: T): void {
  if (!map.has(src)) {
    map.set(src, new Map());
  }
  map.get(src)!.set(key, dest);
}

export class DependencyRegistryResolver {
  /**
   * Default symbols
   */
  #defaultSymbols = new Set<symbol>();

  /**
   * Maps from the requested type id to the candidates
   */
  #byCandidateType = new Map<DependencyClassId, Map<symbol, InjectableCandidateConfig>>();

  /**
   * Maps from inbound class id (file) to the candidates
   */
  #byContainerType = new Map<DependencyClassId, Map<symbol, InjectableCandidateConfig>>();

  #resolveQualifier<T>(type: ClassTarget<T>, resolution?: ResolutionType): symbol | undefined {
    const qualifiers = this.#byCandidateType.get(type.Ⲑid) ?? new Map<symbol, InjectableCandidateConfig>();

    const resolved = [...qualifiers.keys()];
    // If primary found
    if (qualifiers.has(PrimaryCandidateSymbol)) {
      return PrimaryCandidateSymbol;
    } else {
      // If there is only one default symbol
      const filtered = resolved.filter(x => !!x).filter(x => this.#defaultSymbols.has(x));
      if (filtered.length === 1) {
        return filtered[0];
      } else if (filtered.length > 1) {
        // If dealing with sub types, prioritize exact matches
        const exact = this.getCandidateEntries(type)
          .map(([_, x]) => x)
          .filter(x => x.candidateType === type);

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
  registerClass(config: InjectableCandidateConfig, baseParentId?: string): void {
    const candidateType = config.candidateType;
    const candidateClassId = candidateType.Ⲑid;
    const target = config.target ?? candidateType;

    const targetClassId = target.Ⲑid;
    const isSelfTarget = candidateClassId === targetClassId;

    const qualifier = config.qualifier ?? getDefaultQualifier(candidateType);

    // Record qualifier if its the default for the class
    if (config.qualifier === getDefaultQualifier(candidateType)) {
      this.#defaultSymbols.add(config.qualifier);
    }

    // Register inbound config by method and class
    setInMap(this.#byContainerType, config.class.Ⲑid, config.method, config);

    setInMap(this.#byCandidateType, candidateClassId, qualifier, config);

    // Track interface aliases as targets
    const { interfaces } = SchemaRegistryIndex.getConfig(config.class);
    for (const { Ⲑid: interfaceId } of interfaces) {
      setInMap(this.#byCandidateType, interfaceId, qualifier, config);
    }

    // If targeting self (default @Injectable behavior)
    if (isSelfTarget && baseParentId) {
      setInMap(this.#byCandidateType, baseParentId, qualifier, config);
    }

    // Registry primary candidates
    if (config.primary) {
      if (baseParentId) {
        setInMap(this.#byCandidateType, baseParentId, PrimaryCandidateSymbol, config);
      }

      // Register primary for self
      setInMap(this.#byCandidateType, candidateClassId, PrimaryCandidateSymbol, config);

      // Register primary if only one interface provided and no parent config
      if (interfaces.length === 1 && (!baseParentId || !this.#byContainerType.has(baseParentId))) {
        const [primaryInterface] = interfaces;
        const primaryClassId = primaryInterface.Ⲑid;
        setInMap(this.#byCandidateType, primaryClassId, PrimaryCandidateSymbol, config);
      } else if (isSelfTarget) {
        // Register primary for all interfaces if self targeting
        for (const { Ⲑid: interfaceId } of interfaces) {
          setInMap(this.#byCandidateType, interfaceId, PrimaryCandidateSymbol, config);
        }
      }
    }
  }

  /**
   * Resolve the target given a qualifier
   * @param target
   * @param qualifier
   */
  resolveTarget<T>(target: ClassTarget<T>, qualifier?: symbol, resolution?: ResolutionType): Resolved<T> {
    const qualifiers = this.#byCandidateType.get(target.Ⲑid) ?? new Map<symbol, InjectableCandidateConfig>();

    let config: InjectableCandidateConfig;

    if (qualifier && qualifiers.has(qualifier)) {
      config = qualifiers.get(qualifier)!;
    } else {
      qualifier ??= this.#resolveQualifier(target, resolution);

      if (!qualifier) {
        throw new InjectionError('Dependency not found', target);
      } else if (!qualifiers.has(qualifier)) {
        if (!this.#defaultSymbols.has(qualifier) && resolution === 'loose') {
          console.debug('Unable to find specific dependency, falling back to general instance', { qualifier, target: target.Ⲑid });
          return this.resolveTarget(target);
        }
        throw new InjectionError('Dependency not found', target, [qualifier]);
      } else {
        config = qualifiers.get(qualifier!)!;
      }
    }

    return {
      candidate: castTo(config),
      qualifier,
      id: (config.target ?? config.candidateType).Ⲑid
    };
  }

  removeClass(cls: Class, qualifier: symbol): void {
    const classId = cls.Ⲑid;
    this.#defaultSymbols.delete(qualifier);
    this.#byCandidateType.get(classId)!.delete(qualifier);
    this.#byContainerType.get(classId)!.delete(qualifier);
  }

  getCandidateEntries(candidateType: ClassTarget): [symbol, InjectableCandidateConfig][] {
    const candidateTypeId = candidateType.Ⲑid;
    return [...new Set([...(this.#byCandidateType.get(candidateTypeId)?.entries() ?? [])])];
  }
}