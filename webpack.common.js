const path = require('path');

const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports =
{
  entry:
  {
    app: './src/index.js',
  },
  plugins:
  [
    new CopyWebpackPlugin(
    [
      'src/index.html',
      'src/style.css',
      'node_modules/ace-builds/src-min-noconflict/worker-json.js'
    ])
  ],
  output:
  {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist')
  },
};
