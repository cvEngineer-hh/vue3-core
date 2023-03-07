const express = require('express');
const path = require('path');
const { exec } = require('node:child_process');

const app = express();
module.exports.server = function server(portNumber = 3000) {
  portIsActive(portNumber)
    .then(res => {
      createServer(portNumber);
    })
    .catch(err => {
      server(Number(portNumber) + 1);
    });
};

function portIsActive(portNumber) {
  return new Promise((res, rej) => {
    const server = app.listen(portNumber);
    server.on('error', rej);
    server.on('listening', () => (res(), server.close()));
  })
};

function createServer(portNumber) {
  const { address } = require('os').networkInterfaces().WLAN.find(item => item.family === 'IPv4');
  const Network = `http://${address}:${portNumber}`;
  const Local = `http://localhost:${portNumber}`;

  const startTime = Date.now();
  app.use('/', express.static(path.join(__dirname, '../')));
  app.listen(portNumber);

  console.log('\033[42;30m启用服务器，\033[0m 耗时：', Date.now() - startTime, 'ms\033[0m');
  console.log('- Local: ' + '\033[34;4m' + Local + '\033[0m');
  console.log('- Network: ' + '\033[34;4m' + Network + '\033[0m');

  exec(`start ${Network}`);
};

// 刷新暂未实现
module.exports.resetserver = function() {
  
};