'use strict';

const check = require('check-types');
const execa = require('execa');

const exec = async function(command, options = {}) {
  if(!command) {
    check.assert.string(command, 'command is not a string');
  }

  const cwd = options.cwd || process.cwd();

  let args,
      binary;

  if(options.args) {
    binary = command;
    ({args} = options);
  } else {
    [binary, ...args] = command.split(' ');
  }

  const proc = execa(binary, args, {cwd, maxBuffer: 1024 * 100});

  proc.stdout.on('data', data => console.log(data.toString()));
  proc.stderr.on('data', data => console.error(data.toString()));

  return await proc;
};

module.exports = exec;

