import '@arcsine/nodesh';

process.argv[2]
  .$dir({ type: 'file' })
  .$forEach(file => {
    if (!file.endsWith('.js')) {
      return;
    }
    console.log('Writing file', file);
    return $exec('npx', ['uglify-js', file, '-cmo', file, '--source-map', 'content=inline,includeSources,url=inline']);
  });