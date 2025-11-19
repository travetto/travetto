import { SchemaRegistryIndex } from '@travetto/schema';
import { castTo, Class } from '@travetto/runtime';
import { RegistryV2 } from '@travetto/registry';

import { DependencyClassId, DependencyTargetId, PrimaryCandidateSymbol, Resolved } from './types';
import { ClassTarget, getDefaultQualifier, InjectableConfig, InjectionClassConfig, ResolutionType } from '../types';
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
  #targetToClass = new Map<DependencyTargetId, Map<symbol, string>>();
  /**
   * Maps from the class id to the target id, by symbol
   */
  #classToTarget = new Map<DependencyClassId, Map<symbol, DependencyTargetId>>();


  #getTargetClassId(cls: Class, config: InjectableConfig): DependencyTargetId {
    const classId = cls.Ⲑid;
    let target = config.target;

    if (config.factory) {
      const schema = RegistryV2.get(SchemaRegistryIndex, cls).getMethod(config.factory.property);
      target = schema.returnType?.type;
    }
    return target ? target.Ⲑid : classId;
  }

  registerClassToTargetToClass(clsId: DependencyClassId, qualifier: symbol, targetId: DependencyTargetId): void {
    relateViaSymbol(this.#classToTarget, clsId, qualifier, targetId);
    relateViaSymbol(this.#targetToClass, targetId, qualifier, clsId);
  }

  registerTargetToClass(clsId: DependencyClassId, qualifier: symbol, targetId: DependencyTargetId): void {
    relateViaSymbol(this.#targetToClass, targetId, qualifier, clsId);
  }

  registerClassToTarget(clsId: DependencyClassId, qualifier: symbol, targetId: DependencyTargetId): void {
    relateViaSymbol(this.#targetToClass, targetId, qualifier, clsId);
  }


  registerClass(config: InjectableConfig, baseParentId?: string, parentConfig?: InjectableConfig): void {
    const classId = config.class.Ⲑid;

    // Record qualifier if its the default for the class
    if (config.qualifier === getDefaultQualifier(config.class)) {
      this.#defaultSymbols.add(config.qualifier);
    }

    const targetClassId = this.#getTargetClassId(config.class, config);
    const isSelfTarget = (classId === targetClassId || !!config.factory);

    // Register class to target
    this.registerClassToTargetToClass(classId, config.qualifier, targetClassId);

    // Make factory able to be targeted as self
    if (config.factory) {
      this.registerClassToTarget(classId, config.qualifier, classId);
    }

    // Track interface aliases as targets
    const { interfaces } = SchemaRegistryIndex.getConfig(cls);
    for (const { Ⲑid: interfaceId } of interfaces) {
      this.registerClassToTargetToClass(classId, config.qualifier, interfaceId);
    }

    // If targeting self (default @Injectable behavior)
    if (isSelfTarget && baseParentId) {
      this.registerClassToTargetToClass(classId, config.qualifier, baseParentId);
    }

    // Registry primary candidates
    if (config.primary) {
      if (baseParentId) {
        this.registerTargetToClass(baseParentId, PrimaryCandidateSymbol, classId);
      }

      // Register primary for self
      this.registerTargetToClass(classId, PrimaryCandidateSymbol, classId);

      if (config.factory) {
        this.registerTargetToClass(targetClassId, PrimaryCandidateSymbol, classId);
      }

      // Register primary if only one interface provided and no parent config
      if (interfaces.length === 1 && !parentConfig) {
        const [primaryInterface] = interfaces;
        const primaryClassId = primaryInterface.Ⲑid;
        this.registerTargetToClass(primaryClassId, PrimaryCandidateSymbol, classId);
      } else if (isSelfTarget) {
        // Register primary for all interfaces if self targeting
        for (const { Ⲑid: interfaceId } of interfaces) {
          this.registerTargetToClass(interfaceId, PrimaryCandidateSymbol, classId);
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
      const resolved = [...qualifiers.keys()];
      if (!qualifier) {
        // If primary found
        if (qualifiers.has(PrimaryCandidateSymbol)) {
          qualifier = PrimaryCandidateSymbol;
        } else {
          // If there is only one default symbol
          const filtered = resolved.filter(x => !!x).filter(x => this.#defaultSymbols.has(x));
          if (filtered.length === 1) {
            qualifier = filtered[0];
          } else if (filtered.length > 1) {
            // If dealing with sub types, prioritize exact matches
            const exact = this
              .getCandidateTypes(castTo<Class>(target))
              .filter(x => x.class === target);
            if (exact.length === 1) {
              qualifier = exact[0].qualifier;
            } else {
              if (resolution === 'any') {
                qualifier = filtered[0];
              } else {
                throw new InjectionError('Dependency has multiple candidates', target, filtered);
              }
            }
          }
        }
      }

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

    const config: InjectionClassConfig<T> = castTo(this.getConfig(cls!));
    return {
      qualifier,
      config,
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
}