const args = require('minimist')(process.argv.slice(2));
const format = args.f;
const fileName = args._[0] // || 'reactivity';

console.log(fileName, 'fileName');
require('esbuild').build({
  format,
  entryPoints: [fileName ? `packages/${fileName}/src/index` : 'packages/usage/index'],
  bundle: true,
  watch: true,
  outfile: fileName
    ? `dev/Vue${fileName.substring(0, 1).toUpperCase()}${fileName.substring(1).toLowerCase()}.js`
    : 'dev/index.js'
}).then(res => { 
  console.log('--------------启动-------------------');
})