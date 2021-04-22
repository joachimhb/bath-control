'use strict';

const check = require('check-types');
const rpio  = require('rpio');

class LightSensor {
  constructor(params) {
    check.assert.object(params, 'params is not an object');
    check.assert.number(params.gpio, 'params.gpio is not a number');
    check.assert.string(params.location, 'params.location is not a string');
    check.assert.object(params.logger, 'params.logger is not an object');

    Object.assign(this, params);

    this.interval = this.interval || 2000;
    this.value = 'off';
    this.read = this.read.bind(this);

    this.logger.debug(`Initializing Light at ${this.location} at [${this.gpio}] with interval ${this.interval}ms`);

    this.start();
  }

  read() {
    rpio.open(this.gpio, rpio.INPUT);

    const bool = !rpio.read(this.gpio);

    const value = bool ? 'on' : 'off';

    this.logger.trace(`Light at ${this.location} is: ${value}`);

    rpio.close(this.gpio);

    if(this.value !== value && typeof this.onChange === 'function') {
      this.onChange(value);
    }

    this.value = value;
  }

  start() {
    // this.logger.trace(`LightSensor initial read...`);
    // this.read();
    this.logger.trace(`Starting LightSensor interval at ${this.location}...`);

    setInterval(this.read, this.interval);
  }
}

module.exports = LightSensor;
