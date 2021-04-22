'use strict';

const check = require('check-types-2');

class TemperatureControl {
  constructor(params) {
    check.assert.object(params, 'params is not an object');
    check.assert.object(params.eventbus, 'params.eventbus is not an object');
    check.assert.string(params.location, 'params.location is not a string');
    check.assert.object(params.sensor, 'params.sensor is not an object');

    Object.assign(this, params);

    this.sensor.onTemperatureChange = value => this.changed(value);
  }

  changed(value) {
    const {location} = this;

    let level = 'trace';

    if(this.value - value > 3 || this.value - value < -3) {
      level = 'info';
    } else if(this.value - value > 1 || this.value - value < -1) {
      level = 'debug';
    }

    this.logger[level](`TemperatureControl.changed at ${location} to ${value}`);
    this.eventbus.emit(`temperature::changed`, {location, value});
  }
}

module.exports = TemperatureControl;
