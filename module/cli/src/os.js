function launch(path) {
  const op = process.platform === 'darwin' ? 'open' :
    process.platform === 'win32' ? 'cmd /c start' :
    'xdg-open';

  require('child_process').exec(`${op} ${path}`);
}

module.exports = { launch };