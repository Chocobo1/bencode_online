const path = require('path');

const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports =
{
  entry:
  {
    app: './src/main.ts',
  },
  module:
  {
    rules:
    [
      {
        test: /\.tsx?$/,
        loader: "ts-loader"
      }
    ]
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
