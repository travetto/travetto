"use strict";
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _a, _ManifestUtil_getNewest, _ManifestUtil_collectPackages, _ManifestUtil_scanFolder, _ManifestUtil_transformFile, _ManifestUtil_describeModule, _ManifestUtil_buildManifestModules, _ManifestUtil_flattenModuleFiles, _ManifestUtil_deltaModules;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManifestUtil = void 0;
const fs = require("fs");
const path = require("path");
const CWD = process.cwd().replace(/[\\]/g, '/');
class ManifestUtil {
    static buildManifest() {
        return {
            modules: __classPrivateFieldGet(this, _a, "m", _ManifestUtil_buildManifestModules).call(this),
            generated: Date.now()
        };
    }
    static writeManifest(file, manifest) {
        let folder = file;
        if (file.endsWith('.json')) {
            folder = path.dirname(file);
        }
        else {
            file = `${folder}/manifest.json`;
        }
        fs.mkdirSync(folder, { recursive: true });
        fs.writeFileSync(file, JSON.stringify(manifest));
    }
    static readManifest(file) {
        let folder = file;
        if (file.endsWith('.json')) {
            folder = path.dirname(file);
        }
        else {
            file = `${folder}/manifest.json`;
        }
        if (fs.existsSync(file)) {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        }
        else {
            return undefined;
        }
    }
    static produceDelta(outputFolder, left, right) {
        const deltaLeft = Object.fromEntries(Object.values(left.modules)
            .map(m => [m.name, { ...m, files: __classPrivateFieldGet(this, _a, "m", _ManifestUtil_flattenModuleFiles).call(this, m) }]));
        const deltaRight = Object.fromEntries(Object.values(right.modules)
            .map(m => [m.name, { ...m, files: __classPrivateFieldGet(this, _a, "m", _ManifestUtil_flattenModuleFiles).call(this, m) }]));
        const out = {};
        for (const [name, lMod] of Object.entries(deltaLeft)) {
            out[name] = __classPrivateFieldGet(this, _a, "m", _ManifestUtil_deltaModules).call(this, outputFolder, lMod, deltaRight[name] ?? { files: {}, name });
        }
        return out;
    }
    static produceRelativeDelta(outputFolder, manifestFile) {
        return this.produceDelta(outputFolder, ManifestUtil.buildManifest(), ManifestUtil.readManifest(manifestFile) ?? {
            modules: {},
            generated: Date.now()
        });
    }
}
exports.ManifestUtil = ManifestUtil;
_a = ManifestUtil, _ManifestUtil_getNewest = function _ManifestUtil_getNewest(stat) {
    return Math.max(stat.mtimeMs, stat.ctimeMs);
}, _ManifestUtil_collectPackages = function _ManifestUtil_collectPackages(folder, seen = new Set()) {
    const { name, dependencies = {}, devDependencies = {}, peerDependencies = {}, travettoModule = false } = JSON.parse(fs.readFileSync(`${folder}/package.json`, 'utf8'));
    if (seen.has(name)) {
        return [];
    }
    const isModule = name.startsWith('@travetto') || travettoModule;
    const out = [{ name, folder, isModule }];
    seen.add(name);
    const searchSpace = [
        ...Object.keys(dependencies),
        ...[...Object.keys(devDependencies)].filter(x => x.startsWith('@travetto/')),
        ...[...Object.keys(peerDependencies)].filter(x => x.startsWith('@travetto/')),
    ].sort();
    for (const el of searchSpace) {
        try {
            const next = require.resolve(el).replace(/[\\]/g, '/')
                .replace(new RegExp(`^(.*node_modules/${el})(.*)$`), (_, first) => first);
            out.push(...__classPrivateFieldGet(this, _a, "m", _ManifestUtil_collectPackages).call(this, next, seen));
        }
        catch (e) {
            if (process.env.TRV_DEV && el.startsWith('@travetto')) {
                out.push(...__classPrivateFieldGet(this, _a, "m", _ManifestUtil_collectPackages).call(this, el.replace('@travetto', process.env.TRV_DEV), seen));
            }
        }
    }
    return out;
}, _ManifestUtil_scanFolder = function _ManifestUtil_scanFolder(folder, includeTopFolders = new Set()) {
    const out = [];
    if (!fs.existsSync(folder)) {
        return out;
    }
    const stack = [[folder, 0]];
    while (stack.length) {
        const [top, depth] = stack.pop();
        for (const sub of fs.readdirSync(top)) {
            const stat = fs.statSync(`${top}/${sub}`);
            if (stat.isFile()) {
                out.push(`${top}/${sub}`);
            }
            else {
                if (!sub.includes('node_modules') && !sub.startsWith('.') && (depth > 0 || !includeTopFolders.size || includeTopFolders.has(sub))) {
                    stack.push([`${top}/${sub}`, depth + 1]);
                }
            }
        }
    }
    return out;
}, _ManifestUtil_transformFile = function _ManifestUtil_transformFile(relative, full) {
    const type = relative.endsWith('.d.ts') ? 'd.ts' : (relative.endsWith('.ts') ? 'ts' : ((relative.endsWith('.js') || relative.endsWith('mjs') || relative.endsWith('.cjs')) ? 'js' :
        (relative.endsWith('.json') ? 'json' : 'unknown')));
    return [relative, type, __classPrivateFieldGet(this, _a, "m", _ManifestUtil_getNewest).call(this, fs.statSync(full))];
}, _ManifestUtil_describeModule = function _ManifestUtil_describeModule({ name, folder }) {
    const files = __classPrivateFieldGet(this, _a, "m", _ManifestUtil_scanFolder).call(this, folder, folder !== CWD ? new Set(['src', 'bin', 'support']) : new Set())
        .reduce((acc, p) => {
        // Group by top folder
        const rel = p.replace(`${folder}/`, '');
        if (!rel.includes('/')) { // If a file
            if (rel === 'index.ts') {
                acc.index = [__classPrivateFieldGet(this, _a, "m", _ManifestUtil_transformFile).call(this, rel, p)];
            }
            else if (rel === 'doc.ts') {
                acc.docIndex = [__classPrivateFieldGet(this, _a, "m", _ManifestUtil_transformFile).call(this, rel, p)];
            }
            else {
                (acc['rootFiles'] ??= []).push(__classPrivateFieldGet(this, _a, "m", _ManifestUtil_transformFile).call(this, rel, p));
            }
        }
        else {
            const sub = rel.match(/^((?:(test|support)\/resources)|[^/]+)/)[0];
            (acc[sub] ??= []).push(__classPrivateFieldGet(this, _a, "m", _ManifestUtil_transformFile).call(this, rel, p));
        }
        return acc;
    }, {});
    // Refine non-main module
    if (folder !== CWD) {
        files.rootFiles = files.rootFiles.filter(([file, type]) => type !== 'ts');
    }
    return {
        name,
        source: folder,
        output: folder === CWD ? '' : `node_modules/${name}`,
        files
    };
}, _ManifestUtil_buildManifestModules = function _ManifestUtil_buildManifestModules() {
    const modules = __classPrivateFieldGet(this, _a, "m", _ManifestUtil_collectPackages).call(this, CWD)
        .filter(x => x.isModule);
    if (process.env.TRV_DEV && !modules.find(x => x.name === '@travetto/cli')) {
        modules.unshift({
            name: '@travetto/cli',
            folder: `${process.env.TRV_DEV}/cli`,
            isModule: true,
        });
    }
    return Object.fromEntries(modules.map(x => __classPrivateFieldGet(this, _a, "m", _ManifestUtil_describeModule).call(this, x)).map(m => [m.name, m]));
}, _ManifestUtil_flattenModuleFiles = function _ManifestUtil_flattenModuleFiles(m) {
    const out = {};
    for (const key of Object.keys(m.files)) {
        for (const [name, type, date] of m.files[key]) {
            if (type === 'ts' || type === 'd.ts') {
                out[name] = [name, type, date];
            }
        }
    }
    return out;
}, _ManifestUtil_deltaModules = function _ManifestUtil_deltaModules(outputFolder, left, right) {
    let out = [];
    for (const el of Object.keys(left.files)) {
        if (!(el in right.files)) {
            out.push([el, 'added']);
        }
        else {
            const [, , leftTs] = left.files[el];
            const [, , rightTs] = right.files[el];
            if (leftTs > rightTs) {
                out.push([el, 'changed']);
            }
            else {
                try {
                    const stat = fs.statSync(`${outputFolder}/${left.output}/${el}`);
                    if (__classPrivateFieldGet(this, _a, "m", _ManifestUtil_getNewest).call(this, stat) > leftTs) {
                        out.push([el, 'dirty']);
                    }
                }
                catch {
                    out.push([el, 'missing']);
                }
            }
        }
    }
    for (const el of Object.keys(right.files)) {
        if (!(el in left)) {
            out.push([el, 'removed']);
        }
    }
    return out;
};
