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
    new CopyWebpackPlugin({
      patterns:
      [
        { from: 'src/index.html' },
        { from: 'src/style.css' },
        { from: 'node_modules/ace-builds/src-min-noconflict/worker-json.js' },
        { from: 'src/bbb_sunflower_1080p_60fps_normal.mp4.torrent' }
      ]
    })
  ],
  output:
  {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist')
  },
};
