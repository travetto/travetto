# Rework files

The idea is that working with the filesystem is cumbersome and obnoxious in nodejs.

Between `path`, `fs` and things like `os.tmpdir()` or `child_process.exec` you end up with many different places where file paths are relevant that shouldn't need to be.

## The Goal
The goal is to turn all file paths into URIs and translate into file paths only at the time of access.  This access should happen outside the purview of the application developer.

For example on windows `C:\Program Files\blah\blah.exe` would translate to `C:/Program Files/blah/blah.exe`.

All path resolution will be handled via the core utils and should obviate the issues of need to know what platform you are on, or how to handle relative files with ease. 

## Resources
Additionally, resource management is now exposed as a service to facilitate some common patterns.


## TODO
/Users/tim/Code/travetto/module/asset-rest/src/upload-util.ts
  48,28:           const uniqueDir = path.resolve(os.tmpdir(), `rnd.${Math.random()}.${Date.now()}`);
  49,16:           await FsUtil.mkdirpAsync(uniqueDir);
  50,30:           const uniqueLocal = path.resolve(uniqueDir, path.basename(fileName));
  50,54:           const uniqueLocal = path.resolve(uniqueDir, path.basename(fileName));

/Users/tim/Code/travetto/module/asset-s3/src/source.ts
  54,12:       Body: fs.createReadStream(file.path),

/Users/tim/Code/travetto/module/asset/src/model.ts
  45,23:     const res = (await FsUtil.readFileAsync(this.path)).toString();
  46,10:     await FsUtil.unlinkAsync(this.path);

/Users/tim/Code/travetto/module/asset/src/service/asset.ts
  30,46:         return await this.source.write(asset, fs.createReadStream(asset.path));
  36,16:           await FsUtil.unlinkAsync(asset.path);

/Users/tim/Code/travetto/module/asset/src/service/image.ts
  28,22:       n.then(v => v ? FsUtil.unlinkAsync(v) : undefined).catch(err => {
  54,20:       info.stream = fs.createReadStream(file);

/Users/tim/Code/travetto/module/asset/src/util.ts
  13,15: const tmpDir = path.resolve(os.tmpdir());
  20,11:     return path.resolve(tmpDir, name);
  27,16:     const str = fs.createReadStream(pth);
  33,24:     const size = (await FsUtil.statAsync(pth)).size;
  84,21:     const fd = await FsUtil.openAsync(filePath, 'r');
  86,10:     await FsUtil.readAsync(fd, buffer, 0, bytes, 0);
  97,17:     const file = fs.createWriteStream(filePath);
  121,12:       await FsUtil.renameAsync(filePath, newFilePath);

/Users/tim/Code/travetto/module/base/src/fs/fs-util.d.ts
  5,18:   mkdirAsync(rel: fs.PathLike): Promise<void>;
  6,22:   readFileAsync(path: fs.PathLike, options?: { encoding?: null; flag?: string; } | string): Promise<Buffer>;
  7,23:   writeFileAsync(path: fs.PathLike, contents: string | Buffer, options?: fs.WriteFileOptions): Promise<void>;
  7,73:   writeFileAsync(path: fs.PathLike, contents: string | Buffer, options?: fs.WriteFileOptions): Promise<void>;
  8,18:   statAsync(path: fs.PathLike): Promise<fs.Stats>;
  9,19:   lstatAsync(path: fs.PathLike): Promise<fs.Stats>;
  10,20:   existsAsync(path: fs.PathLike): Promise<boolean>;
  11,20:   unlinkAsync(path: fs.PathLike): Promise<void>;
  12,20:   renameAsync(from: fs.PathLike, to: fs.PathLike): Promise<void>;
  12,37:   renameAsync(from: fs.PathLike, to: fs.PathLike): Promise<void>;
  14,22:   readlinkAsync(path: fs.PathLike, options?: { encoding?: BufferEncoding | null } | BufferEncoding | null): Promise<string>;
  15,22:   readlinkAsync(path: fs.PathLike, options: { encoding: "buffer" } | "buffer"): Promise<Buffer>;
  16,22:   readlinkAsync(path: fs.PathLike, options?: { encoding?: string | null } | string | null): Promise<string | Buffer>;
  18,22:   realpathAsync(path: fs.PathLike, options?: { encoding?: BufferEncoding | null } | BufferEncoding | null): Promise<string>;
  19,22:   realpathAsync(path: fs.PathLike, options: { encoding: "buffer" } | "buffer"): Promise<Buffer>;
  20,22:   realpathAsync(path: fs.PathLike, options?: { encoding?: string | null } | string | null): Promise<string | Buffer>;
  22,18:   openAsync(path: fs.PathLike, flags: string | number, mode?: string | number | null): Promise<number>;
  23,29:   writeAsync<TBuffer extends fs.BinaryData>(
  32,28:   readAsync<TBuffer extends fs.BinaryData>(fd: number, buffer: TBuffer, offset: number, length: number, position: number | null): Promise<{ bytesRead: number, buffer: TBuffer }>;
  35,21:   readdirAsync(path: fs.PathLike, options?: { encoding?: BufferEncoding | null } | BufferEncoding | null): Promise<string[]>;
  36,21:   readdirAsync(path: fs.PathLike, options: { encoding: "buffer" } | "buffer"): Promise<Buffer[]>;
  37,21:   readdirAsync(path: fs.PathLike, options?: { encoding?: string | null } | string | null): Promise<string[] | Buffer[]>;

/Users/tim/Code/travetto/module/base/src/fs/scan-fs.ts
  9,9:   stats: fs.Stats;
  36,34:         for (const file of (await FsUtil.readdirAsync(entry.file))) {
  41,23:           const full = path.resolve(entry.file, file);
  42,30:           const stats = await FsUtil.lstatAsync(full);
  47,30:               const p = await FsUtil.realpathAsync(full);
  90,23:     for (const file of fs.readdirSync(entry.file)) {
  95,19:       const full = path.resolve(entry.file, file);
  96,20:       const stats = fs.lstatSync(full);
  101,20:           const p = fs.realpathSync(full);
  144,16:       .map(x => FsUtil.readFileAsync(x.file).then(d => ({ name: x.file, data: d.toString() })));
  151,39:       .map(x => ({ name: x.file, data: fs.readFileSync(x.file).toString() }));

/Users/tim/Code/travetto/module/base/src/resource.ts
  25,37:     this.paths = this.paths.map(x => path.join(x, this.folder)).filter(x => fs.existsSync(x));
  25,76:     this.paths = this.paths.map(x => path.join(x, this.folder)).filter(x => fs.existsSync(x));
  37,10:     pth = FsUtil.normalize(pth);
  43,40:     for (const f of this.paths.map(x => path.join(x, pth))) {
  44,16:       if (await FsUtil.existsAsync(f)) {
  54,11:     return FsUtil.readFileAsync(pth);
  59,11:     return fs.createReadStream(pth);
  63,11:     base = FsUtil.normalize(base);
  67,79:       const results = await ScanFs.scanDir({ testFile: x => x.endsWith(ext) }, path.resolve(root, base));

/Users/tim/Code/travetto/module/base/src/watch.ts
  19,37:   private watchers = new Map<string, fs.FSWatcher>();
  20,43:   private pollers = new Map<string, (curr: fs.Stats, prev: fs.Stats) => void>();
  20,59:   private pollers = new Map<string, (curr: fs.Stats, prev: fs.Stats) => void>();
  47,13:       stats: fs.lstatSync(this.options.cwd)
  54,4:     fs.readdir(dir.file, (err, current) => {
  64,65:       current = current.filter(x => !x.startsWith('.')).map(x => path.join(dir.file, x));
  89,26:         const nextStats = fs.lstatSync(next);
  125,22:       const watcher = fs.watch(entry.file, Util.throttle((event, f) => {
  151,40:     this.pollers.set(entry.file, (curr: fs.Stats, prev: fs.Stats) => {
  151,56:     this.pollers.set(entry.file, (curr: fs.Stats, prev: fs.Stats) => {
  156,22:         const stats = fs.lstatSync(entry.file);
  171,6:       fs.watchFile(entry.file, opts, this.pollers.get(entry.file)!);
  181,6:       fs.unwatchFile(entry.file, this.pollers.get(entry.file)!);

/Users/tim/Code/travetto/module/compiler/src/presence.ts
  106,23:       const topLevel = path.dirname(name);

/Users/tim/Code/travetto/module/config/src/service/loader.ts
  31,25:           const tested = path.basename(x.name).replace(YAML_RE, '');
  56,15:     const ns = path.basename(file).replace(YAML_RE, '');

/Users/tim/Code/travetto/module/email-template/src/config.ts
  14,45:       ...ResourceManager.getPaths().map(x => path.resolve(x, 'email')),

/Users/tim/Code/travetto/module/email-template/src/template.ts
  31,21:         const full = path.resolve(__dirname, '..', 'resources', partial);
  64,16:     if (!(await FsUtil.existsAsync(out))) {
  68,11:     return FsUtil.readFileAsync(out);

/Users/tim/Code/travetto/module/email-template/src/util.ts
  49,4:     fs.createReadStream(file).pipe(proc.stdin);
  66,18:       const ext = path.extname(src).split('.')[1];

/Users/tim/Code/travetto/module/exec/src/docker.ts
  91,14:     const p = fs.mkdtempSync(`/tmp/${this.image.replace(/[^A-Za-z0-9]/g, '_')}`);
  190,60:     const mkdirAll = Object.keys(this.tempVolumes).map(x => FsUtil.mkdirpAsync(x).catch(e => { }));
  273,18:         .map(x => FsUtil.unlinkAsync(x.file)
  302,18:         const f = path.join(dir, name);
  303,14:         await FsUtil.writeFileAsync(f, content, { mode: '755' });

/Users/tim/Code/travetto/module/log/src/output/file.ts
  8,17:   const stream = fs.createWriteStream(opts.file, {

/Users/tim/Code/travetto/module/rest-fastify/src/provider.ts
  122,13:       path = path.replace(/\/+/g, '/').replace(/\/+$/, '');

/Users/tim/Code/travetto/module/rest/src/decorator/endpoint.ts
  7,36:     if (typeof path === 'string' && path.includes(':')) {
  8,6:       path.replace(/:([A-Za-z0-9_]+)/, (a, name) => {

/Users/tim/Code/travetto/module/swagger/src/client-generate.ts
  29,10:     await FsUtil.mkdirpAsync(this.config.output);
  74,21:     const specFile = path.join(this.config.output, 'spec.json');
  75,36:     await new Promise((res, rej) => fs.writeFile(specFile, JSON.stringify(spec, undefined, 2), (err) => err ? rej(err) : res()));

/Users/tim/Code/travetto/module/swagger/src/config.ts
  35,18:     this.output = path.resolve(this.output);

/Users/tim/Code/travetto/module/test/src/runner/executor.ts
  20,20:       const input = fs.createReadStream(file);
  235,13:       file = path.join(Env.cwd, file);