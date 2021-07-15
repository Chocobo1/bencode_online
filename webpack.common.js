const path = require('path');

const CopyWebpackPlugin = require('copy-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

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
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.tsx?$/,
        use: 'ts-loader'
      },
      {
        test: /\.ttf$/,
        use: 'file-loader'
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
        { from: 'src/bbb_sunflower_1080p_60fps_normal.mp4.torrent' }
      ]
    }),
    new MonacoWebpackPlugin({
      options: {
          languages: ['json']
      }
    })
  ],
  output:
  {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist')
  },
};
