'use strict';

const exec = require('./deployment/exec');

(async function() {
  try {
    const buildCmd = 'docker build --tag bath-control:latest .';
    const createCmd = 'docker create --name bath-control bath-control --log-opt max-size=1m --logopt max-file=10 --volume /dev/mem:/dev/mem --privileged --cap-add SYS_RAWIO';
    const startCmd = 'docker start bath-control';
    const stopCmd = 'docker stop bath-control';
    const removeCmd = 'docker rm -v bath-control';

    console.log(`Running: ${buildCmd}`);
    await exec(buildCmd);
    console.log(`Running: ${createCmd}`);

    try {
      console.log(`Running: ${stopCmd}`);
      await exec(buildCmd);
      console.log(`Running: ${removeCmd}`);
    await exec(buildCmd);
    } catch(errRm) {
      // whatever
      console.log(errRm);
    }
    await exec(createCmd);
    console.log(`Running: ${startCmd}`);
    await exec(startCmd);
  } catch(err) {
    console.error(`Failed`, err);
  }
})();

