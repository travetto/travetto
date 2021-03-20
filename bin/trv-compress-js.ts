import '@arcsine/nodesh';

process.argv[2]
  .$dir()
  .$forEach(file => {
    console.log('Writing file', file);
    let inComment = false;

    return file
      .$readLines({ mode: 'object' })
      .$map(({ text: x }) => {
        if (!inComment) {
          if (x.includes('/*')) {
            inComment = true;
            return x.replace(/\/[*].*$/, '');
          }
        }
        if (inComment) {
          if (x.includes('*/')) {
            inComment = false;
            return x.replace(/^.*[*]\//, '');
          } else {
            return '';
          }
        }
        return x.replace(/(([ ]\/\/)|(\/\/#))[^*`\n]+/, '');
      })
      .$trim()
      .$notEmpty()
      .$writeFinal(file);
  });