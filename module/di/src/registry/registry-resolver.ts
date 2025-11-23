import { SchemaRegistryIndex } from '@travetto/schema';
import { castTo, Class } from '@travetto/runtime';

import { DependencyClassId, DependencyTargetId, PrimaryCandidateSymbol, Resolved } from './types';
import { ClassTarget, getDefaultQualifier, InjectableConfig, ResolutionType } from '../types';
import { InjectionError } from '../error';

function relateViaSymbol(map: Map<string, Map<symbol, string>>, src: string, qual: symbol, dest: string): void {
  if (!map.has(src)) {
    map.set(src, new Map());
  }
  map.get(src)!.set(qual, dest);
}

export class DependencyRegistryResolver {
  /**
   * Default symbols
   */
  #defaultSymbols = new Set<symbol>();
  /**
   * Maps from the target id to the class id, by symbol
   */
  #targetToClass = new Map<DependencyTargetId, Map<symbol, DependencyClassId>>();
  /**
   * Maps from the class id to the target id, by symbol
   */
  #classToTarget = new Map<DependencyClassId, Map<symbol, DependencyTargetId>>();

  #resolveConfig: <T>(cls: DependencyClassId) => InjectableConfig<T>;

  constructor(configResolver: <T>(clsId: DependencyClassId) => InjectableConfig<T>) {
    this.#resolveConfig = configResolver;
  }

  #getSourceClass(config: InjectableConfig): Class {
    return config.type === 'factory' ? config.returnType : config.class;
  }

  #registerTargetToClass(clsId: DependencyClassId, qualifier: symbol, targetId: DependencyTargetId): void {
    relateViaSymbol(this.#targetToClass, targetId, qualifier, clsId);
  }

  #registerClassToTarget(clsId: DependencyClassId, qualifier: symbol, targetId: DependencyTargetId, inverse = false): void {
    relateViaSymbol(this.#classToTarget, clsId, qualifier, targetId);
    if (inverse) {
      relateViaSymbol(this.#targetToClass, targetId, qualifier, clsId);
    }
  }

  #resolveQualifier<T>(target: ClassTarget<T>, resolution?: ResolutionType): symbol | undefined {
    const qualifiers = this.#targetToClass.get(target.Ⲑid) ?? new Map<symbol, string>();

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
        const exact = this
          .getTargetedTypes(castTo<Class>(target))
          .map(this.#resolveConfig)
          .filter(x => x.class === target);
        if (exact.length === 1) {
          return exact[0].qualifier;
        } else {
          if (resolution === 'any') {
            return filtered[0];
          } else {
            throw new InjectionError('Dependency has multiple candidates', target, filtered);
          }
        }
      }
    }
  }

  /**
   * Register a class with the dependency resolver
   */
  registerClass(config: InjectableConfig, baseParentId?: string): void {
    const cls = this.#getSourceClass(config);
    const target = config.target ?? cls;

    const targetClassId = target.Ⲑid;
    const classId = cls.Ⲑid;
    const isSelfTarget = classId === targetClassId;

    // Record qualifier if its the default for the class
    if (config.qualifier === getDefaultQualifier(config.class)) {
      this.#defaultSymbols.add(config.qualifier);
    }

    // Register class to target
    this.#registerClassToTarget(classId, config.qualifier, targetClassId, true);

    if (config.type === 'factory') {
      this.#registerTargetToClass(classId, config.qualifier, classId);
    }

    // Track interface aliases as targets
    const { interfaces } = SchemaRegistryIndex.getConfig(config.class);
    for (const { Ⲑid: interfaceId } of interfaces) {
      this.#registerClassToTarget(classId, config.qualifier, interfaceId, true);
    }

    // If targeting self (default @Injectable behavior)
    if (isSelfTarget && baseParentId) {
      this.#registerClassToTarget(classId, config.qualifier, baseParentId, true);
    }

    // Registry primary candidates
    if (config.primary) {
      if (baseParentId) {
        this.#registerTargetToClass(baseParentId, PrimaryCandidateSymbol, classId);
      }

      // Register primary for self
      this.#registerTargetToClass(classId, PrimaryCandidateSymbol, classId);

      if (config.type === 'factory') {
        this.#registerTargetToClass(targetClassId, PrimaryCandidateSymbol, classId);
      }

      // Register primary if only one interface provided and no parent config
      if (interfaces.length === 1 && !this.#classToTarget.has(baseParentId!)) {
        const [primaryInterface] = interfaces;
        const primaryClassId = primaryInterface.Ⲑid;
        this.#registerTargetToClass(primaryClassId, PrimaryCandidateSymbol, classId);
      } else if (isSelfTarget) {
        // Register primary for all interfaces if self targeting
        for (const { Ⲑid: interfaceId } of interfaces) {
          this.#registerTargetToClass(interfaceId, PrimaryCandidateSymbol, classId);
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
    const qualifiers = this.#targetToClass.get(target.Ⲑid) ?? new Map<symbol, string>();

    let cls: string | undefined;

    if (qualifier && qualifiers.has(qualifier)) {
      cls = qualifiers.get(qualifier);
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
        cls = qualifiers.get(qualifier!)!;
      }
    }

    const config = this.#resolveConfig<T>(cls!);
    return {
      config,
      qualifier,
      id: (config.target ?? config.class).Ⲑid
    };
  }

  removeClass(cls: Class, qualifier: symbol): void {
    const classId = cls.Ⲑid;
    this.#defaultSymbols.delete(qualifier);
    this.#classToTarget.get(classId)!.delete(qualifier);
  }

  getQualifiers(cls: Class): symbol[] {
    const classId = cls.Ⲑid;
    return [...new Set([...(this.#classToTarget.get(classId)?.keys() ?? [])])];
  }

  getTargetedTypes(cls: Class): DependencyTargetId[] {
    const classId = cls.Ⲑid;
    return [...new Set([...(this.#classToTarget.get(classId)?.values() ?? [])])];
  }
}