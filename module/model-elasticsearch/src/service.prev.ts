// export class ElasticsearchModelService implements ModelCrudSupport, ModelStorageSupport, ModelIndexedSupport, ModelBulkSupport {

//   /**
//    * Support basic suggestion queries for autocompleting
//    */
//   async suggest<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<string[]> {
//     const search = this.buildRawMultiSuggestQuery([cls], field, prefix, {
//       // @ts-ignore
//       select: { [field]: 1 },
//       ...query
//     });
//     const res = await this.execSearch(search);
//     const safe = this.safeLoad<T>(search, res);
//     return ModelUtil.combineSuggestResults(cls, field, prefix, safe, x => x, query && query.limit);
//   }

//   /**
//    * Basic faceting support
//    */
//   async facet<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, query?: ModelQuery<T>): Promise<{ key: string, count: number }[]> {
//     const q = query && query.where ? ElasticsearchUtil.extractWhereQuery(cls, query.where) : { ['match_all']: {} };
//     const search = {
//       ...this.getIdentity(cls),
//       body: {
//         query: q,
//         aggs: {
//           [field]: {
//             terms: { field, size: 100 },
//           }
//         }
//       },
//       size: 0
//     };

//     const res = await this.execSearch(search);
//     const { buckets } = res.aggregations[field];
//     const out = buckets.map(b => ({ key: b.key, count: b.doc_count }));
//     return out;
//   }

//   /**
//    * Suggesting entire objects vs just fields
//    */
//   async suggestEntities<T extends ModelType>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<T[]> {
//     const search = this.buildRawMultiSuggestQuery([cls], field, prefix, query);
//     const res = await this.execSearch(search);
//     const safe = this.safeLoad<T>(search, res);
//     return ModelUtil.combineSuggestResults(cls, field, prefix, safe, (x, v) => v, query && query.limit);
//   }

//   /**
//    * Transform the search response to build full instantiated objects
//    */
//   async convertRawResponse<T extends ModelType>(response: SearchResponse<T>) {
//     const out: T[] = [];

//     for (const item of response.hits.hits) {
//       const itemCls = this.getClassFromIndexType(item._index, item._source.type!);
//       const obj: T = itemCls.from(item._source as T);
//       obj.id = item._id;
//       this.postLoad(itemCls, obj);
//       if (obj.postLoad) {
//         await obj.postLoad();
//       }
//       obj.type = itemCls.name.toLowerCase();
//       out.push(obj);
//     }
//     return out;
//   }

//   /**
//    * Build the raw model filters, supporting polymorphism
//    */
//   buildRawModelFilters<T extends ModelType = ModelType>(classes: Class<T>[]) {
//     const types = classes.map(t => {
//       const conf = ModelRegistry.get(t);
//       let idx = this.getIdentity(conf.class).index;
//       idx = this.aliasToIndex.get(idx) ?? idx;
//       if (!conf.subType) {
//         return { term: { _index: idx } };
//       } else {
//         return {
//           bool: {
//             must: [
//               { term: { _index: idx } },
//               { term: { type: conf.subType } },
//             ]
//           }
//         };
//       }
//     });

//     return {
//       bool: {
//         ['minimum_should_match']: 1,
//         should: types
//       }
//     };
//   }

//   /**
//    * Build query to support searching multiple fields
//    */
//   buildRawMultiSuggestQuery<T extends ModelType = ModelType>(
//     classes: Class<T>[], field: ValidStringFields<T>, query?: string,
//     filter?: Query<T>
//   ) {
//     const spec = SchemaRegistry.getViewSchema(classes[0]).schema[field as keyof SchemaConfig].specifier;
//     const text = spec && spec.startsWith('text');

//     if (!text) {
//       console.warn(`${classes[0].ᚕid}.${field} is not registered as @Text, reverting to keyword search`);
//     }

//     const res = this.buildRawMultiQuery(classes, filter, query ? {
//       ['match_phrase_prefix']: {
//         [text ? `${field}.text` : field]: {
//           query
//         }
//       }
//     } : {});

//     res.size = filter?.limit ?? 10;

//     return res;
//   }

//   /**
//    * Support searching multiple indices at the same time
//    */
//   buildRawMultiQuery<T extends ModelType = ModelType>(classes: Class<T>[], query?: Query<T>, raw?: any) {
//     const searchObj = this.getPlainSearchObject(classes[0], query ?? {});
//     searchObj.body = {
//       query: {
//         bool: {
//           must: [
//             searchObj.body.query ?? { ['match_all']: {} },
//             ...(raw ? [raw] : [])
//           ],
//           filter: this.buildRawModelFilters(classes)
//         }
//       }
//     };
//     return searchObj;
//   }

//   async getRawMultiQuery<T extends ModelType = ModelType>(classes: Class<T>[], query: Query<T>) {
//     const searchObj = this.buildRawMultiQuery(classes, query);
//     return this.execSearch(searchObj);

//   }
// }