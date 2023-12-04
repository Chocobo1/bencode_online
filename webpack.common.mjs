import CopyWebpackPlugin from 'copy-webpack-plugin';
import Path from 'path';
import Url from 'url';

const __filename = Url.fileURLToPath(import.meta.url);
const __dirname = Path.dirname(__filename);

export default
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
        { from: 'node_modules/ace-builds/src-min-noconflict/theme-idle_fingers.js', to: 'js' },
        { from: 'node_modules/ace-builds/src-min-noconflict/worker-json.js', to: 'js' },
        { from: 'src/assets/bootstrap.min.css', to: 'css' },
        { from: 'src/assets/bootstrap.min.js', to: 'js' },
        { from: 'src/assets/github.svg', to: 'assets' },
        { from: 'src/bbb_sunflower_1080p_60fps_normal.mp4.torrent', to: 'assets' },
        { from: 'src/index.html' },
        { from: 'src/style.css', to: 'css' }
      ]
    })
  ],
  output:
  {
    filename: 'js/main.js',
    path: Path.resolve(__dirname, 'dist')
  },
};
