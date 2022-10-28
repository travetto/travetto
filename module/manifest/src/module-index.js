"use strict";
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _$ModuleIndex_instances, _$ModuleIndex_modules, _$ModuleIndex_root, _$ModuleIndex_resolve, _$ModuleIndex_loadManifest, _$ModuleIndex_moduleFiles, _$ModuleIndex_index_get;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleIndex = void 0;
const path = require("path");
const CWD = process.cwd().replace(/[\\]/g, '/');
/**
 * Module index, files to be loaded at runtime
 */
class $ModuleIndex {
    constructor(root) {
        _$ModuleIndex_instances.add(this);
        _$ModuleIndex_modules.set(this, void 0);
        _$ModuleIndex_root.set(this, void 0);
        __classPrivateFieldSet(this, _$ModuleIndex_root, root, "f");
    }
    get modules() {
        return __classPrivateFieldGet(this, _$ModuleIndex_modules, "f");
    }
    /**
     * Clears the app scanning cache
     */
    reset() {
        // @ts-expect-error
        __classPrivateFieldSet(this, _$ModuleIndex_modules, undefined, "f");
    }
    /**
     * Find files from the index
     * @param folder The sub-folder to check into
     * @param filter The filter to determine if this is a valid support file
     */
    find(config) {
        const { filter: f, folder } = config;
        const filter = f ? 'test' in f ? f.test.bind(f) : f : f;
        const idx = __classPrivateFieldGet(this, _$ModuleIndex_instances, "a", _$ModuleIndex_index_get);
        const searchSpace = folder ?
            idx.flatMap(m => [...m.files[folder] ?? [], ...(config.includeIndex ? m.files.index : [])]) :
            idx.flatMap(m => [...Object.values(m.files)].flat());
        return searchSpace
            .filter(({ type }) => type === 'ts')
            .filter(({ file }) => filter?.(file) ?? true);
    }
    /**
     * Find files from the index
     * @param filter The filter to determine if this is a valid support file
     */
    findSupport(config) {
        return this.find({ ...config, folder: 'support' });
    }
    /**
     * Find files from the index
     * @param filter The filter to determine if this is a valid support file
     */
    findSrc(config) {
        return this.find({ ...config, folder: 'src', includeIndex: true });
    }
    findOwnSrc() {
        return this.findSrc({
            filter: x => !x.includes('node_modules') && x.includes('src/')
        });
    }
    /**
     * Find files from the index
     * @param filter The filter to determine if this is a valid support file
     */
    findTest(config) {
        return this.find({ ...config, folder: 'test' });
    }
}
_$ModuleIndex_modules = new WeakMap(), _$ModuleIndex_root = new WeakMap(), _$ModuleIndex_instances = new WeakSet(), _$ModuleIndex_resolve = function _$ModuleIndex_resolve(...parts) {
    return path.resolve(__classPrivateFieldGet(this, _$ModuleIndex_root, "f"), ...parts).replace(/[\\]/g, '/');
}, _$ModuleIndex_loadManifest = function _$ModuleIndex_loadManifest() {
    const modules = require(__classPrivateFieldGet(this, _$ModuleIndex_instances, "m", _$ModuleIndex_resolve).call(this, 'manifest.json'));
    return modules;
}, _$ModuleIndex_moduleFiles = function _$ModuleIndex_moduleFiles(m, files) {
    return files.map(([f, type]) => {
        const source = path.join(m.source, f);
        const fullFile = __classPrivateFieldGet(this, _$ModuleIndex_instances, "m", _$ModuleIndex_resolve).call(this, m.output, f).replace(/[.]ts$/, '.js');
        const module = (m.output.startsWith('node_modules') ?
            `${m.output.split('node_modules/')[1]}/${f}` :
            `./${f}`).replace(/[.]ts$/, '.js');
        return {
            type,
            source,
            file: fullFile,
            module
        };
    });
}, _$ModuleIndex_index_get = function _$ModuleIndex_index_get() {
    return __classPrivateFieldSet(this, _$ModuleIndex_modules, __classPrivateFieldGet(this, _$ModuleIndex_modules, "f") ?? Object.values(__classPrivateFieldGet(this, _$ModuleIndex_instances, "m", _$ModuleIndex_loadManifest).call(this).modules).map(m => ({
        ...m,
        files: Object.fromEntries(Object.entries(m.files).map(([folder, files]) => [folder, __classPrivateFieldGet(this, _$ModuleIndex_instances, "m", _$ModuleIndex_moduleFiles).call(this, m, files)]))
    })), "f");
};
exports.ModuleIndex = new $ModuleIndex((process.env.TRV_CACHE ?? process.cwd()).replace(/[\\]/g, '/'));
