const express = require('express');
const path = require('path');
const { exec } = require('node:child_process');

const PortNumber = '3000';
const { address } = require('os').networkInterfaces().WLAN.find(item => item.family === 'IPv4');
const Network = `http://${address}:${PortNumber}`;
const Local = `http://localhost:${PortNumber}`;

const app = express();
module.exports.createScerver = function() {
  const startTime = Date.now();
  app.use('/', express.static(path.join(__dirname, '../dev')));
  app.listen(PortNumber);

  console.log('\033[42;30m启用服务器，\033[0m 耗时：', Date.now() - startTime, 'ms\033[0m');
  console.log('- Local: ' + '\033[34;4m' + Local + '\033[0m');
  console.log('- Network: ' + '\033[34;4m' + Network + '\033[0m');

  exec(`start ${Network}`);
};

// 刷新暂未实现
module.exports.resetScerve = function() {
  
};