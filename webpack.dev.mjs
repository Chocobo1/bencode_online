import { merge } from 'webpack-merge';

import common from './webpack.common.mjs';

export default merge(common, {
  devtool: 'inline-source-map'
});
