require('fs').readFile('.env.development', 'utf-8', (err, data) => {
  if(err) {
    console.log('未设置.env.development文件');
    build({});
    return;
  }

  build(parseEnv(data));
});

const args = require('minimist')(process.argv.slice(2));
const { server } = require('./createServer');
function build(env) {
  const path = require('path');
  const format = args.f || 'esm';

  console.log(args, 'args');

  require('esbuild').build({
    format,
    bundle: true,
    watch: {
      onRebuild(error) {
        if(error) console.log('编译失败：', error);
        console.log('更新');
      }
    },
    define: { dev: args._.includes('dev'), ...env },
    entryPoints: [path.join(__dirname, '../src/main.ts')],
    outfile: '/dev/index.js'
  }).then(res => {
    console.log(
`                ⠰⢷⢿.
            ⠀⠀⠀⠀⠀⣼⣷⣄
            ⠀⠀⣤⣿⣇⣿⣿⣧⣿⡄
            ⢴⠾⠋⠀⠀⠻⣿⣷⣿⣿⡀
            ○ ⠀⢀⣿⣿⡿⢿⠈⣿
            ⠀⠀⠀⢠⣿⡿⠁⠀⡊⠀⠙
            ⠀⠀⠀⢿⣿⠀⠀⠹⣿
            ⠀⠀⠀⠀⠹⣷⡀⠀⣿⡄
            ⠀⠀⠀⠀⣀⣼⣿⠀⢈⣧.

            神兽保佑 永无bug
      `
    );
    
    server();
  })
};

function parseEnv(data) {
  const arr = data.split('\r')
    .filter(item => !item.includes('#'))
    .map(item => item.replace(/\/n|\s/g, '').split('='))
  return Object.fromEntries(arr);
};