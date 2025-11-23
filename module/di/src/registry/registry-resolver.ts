import { SchemaRegistryIndex } from '@travetto/schema';
import { castTo, Class } from '@travetto/runtime';

import { getDefaultQualifier, InjectableCandidate, PrimaryCandidateSymbol, ResolutionType } from '../types';
import { InjectionError } from '../error';

type Resolved<T> = { candidate: InjectableCandidate<T>, qualifier: symbol, targetId: string };
type ClassId = string;

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
  #byCandidateType = new Map<ClassId, Map<symbol, InjectableCandidate>>();

  /**
   * Maps from inbound class id (file) to the candidates
   */
  #byContainerType = new Map<ClassId, Map<symbol, InjectableCandidate>>();

  #resolveQualifier<T>(type: Class<T>, resolution?: ResolutionType): symbol | undefined {
    const qualifiers = this.#byCandidateType.get(type.Ⲑid) ?? new Map<symbol, InjectableCandidate>();

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
  registerClass(config: InjectableCandidate, baseParentId?: string): void {
    const candidateType = config.candidateType;
    const candidateClassId = candidateType.Ⲑid;
    const target = config.target ?? candidateType;

    const targetClassId = target.Ⲑid;
    const isSelfTarget = candidateClassId === targetClassId;

    const qualifier = config.qualifier ?? getDefaultQualifier(candidateType);

    console.error('DependencyRegistryResolver.registerClass status', {
      candidateClassId,
      targetClassId,
      qualifier: qualifier.toString(),
      isSelfTarget,
      baseParentId
    });

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
   * @param candidateType
   * @param qualifier
   */
  resolveCandidate<T>(candidateType: Class<T>, qualifier?: symbol, resolution?: ResolutionType): Resolved<T> {
    const qualifiers = this.#byCandidateType.get(candidateType.Ⲑid) ?? new Map<symbol, InjectableCandidate>();

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
        console.error('Qualifier lookup failed', { qualifier, target: candidateType.Ⲑid, available: [...qualifiers.keys()] });
        throw new InjectionError('Dependency not found', candidateType, [qualifier]);
      } else {
        config = qualifiers.get(qualifier!)!;
      }
    }

    return {
      candidate: castTo(config),
      qualifier,
      targetId: (config.target ?? config.candidateType).Ⲑid
    };
  }

  removeClass(cls: Class, qualifier: symbol): void {
    const classId = cls.Ⲑid;
    this.#defaultSymbols.delete(qualifier);
    this.#byCandidateType.get(classId)!.delete(qualifier);
    this.#byContainerType.get(classId)!.delete(qualifier);
  }

  getCandidateEntries(candidateType: Class): [symbol, InjectableCandidate][] {
    const candidateTypeId = candidateType.Ⲑid;
    return [...new Set([...(this.#byCandidateType.get(candidateTypeId)?.entries() ?? [])])];
  }

  getContainerEntries(containerType: Class): [symbol, InjectableCandidate][] {
    const containerTypeId = containerType.Ⲑid;
    return [...new Set([...(this.#byContainerType.get(containerTypeId)?.entries() ?? [])])];
  }
}