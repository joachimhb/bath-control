const check = require('check-types');
const rpio  = require('rpio');

class LightSensor {
  constructor(params) {
    check.assert.object(params, 'params is not an object');
    check.assert.number(params.pin, 'params.pin is not a number');
    check.assert.string(params.location, 'params.location is not a string');
    check.assert.object(params.logger, 'params.logger is not an object');

    Object.assign(this, params);

    this.interval = this.interval || 3000;
    this.value = null;
    this.read = this.read.bind(this);

    this.start();
  }

  read() {
    rpio.open(this.pin, rpio.INPUT);

    const value = !rpio.read(this.pin);

    this.logger.debug(`Light at ${this.location} is: ${value ? 'ON' : 'OFF'}`);

    rpio.close(this.pin);

    if(this.value !== value && typeof this.onChange === 'function') {
      this.onChange(value);
    }

    this.value = value;
  }

  start() {
    // this.logger.debug(`LightSensor initial read...`);
    // this.read();
    this.logger.debug(`Starting LightSensor interval at ${this.location}...`);

    setInterval(this.read, this.interval);
  }
}

module.exports = LightSensor;
