'use strict';

const check = require('check-types');

class LightControl {
  constructor(params) {
    check.assert.object(params, 'params is not an object');
    check.assert.object(params.eventbus, 'params.eventbus is not an object');
    check.assert.string(params.location, 'params.location is not a string');
    check.assert.object(params.sensor, 'params.sensor is not an object');

    Object.assign(this, params);

    this.sensor.onChange = value => this.changed(value);
  }

  changed(value) {
    const {location} = this;

    this.logger.info(`LightControl.changed at ${location} to ${value}`);
    this.eventbus.emit(`light::changed`, {location, value});
  }
}

module.exports = LightControl;
