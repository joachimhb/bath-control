'use strict';

const check = require('check-types');
const dht   = require('pigpio-dht');

class DHT22 {
  constructor(params) {
    check.assert.object(params, 'params is not an object');
    check.assert.number(params.gpio, 'params.gpio is not a number');
    check.assert.string(params.location, 'params.location is not a string');
    check.assert.object(params.logger, 'params.logger is not an object');

    Object.assign(this, params);

    this.interval = this.interval || 5000;
    this.humidity = 0;
    this.temperature = 0;

    this.sensor = dht(this.gpio, 22);

    this.logger.debug(`Initializing DHT22 at ${this.location} at [${this.gpio}] with interval ${this.interval}ms`);

    this.start();

    this.sensor.on('result', data => {
      let {humidity, temperature} = data;

      humidity = Math.round(humidity * 10) / 10;
      temperature = Math.round(temperature * 10) / 10;

      this.logger.trace(`Humidity at ${this.location}: ${humidity}`);
      this.logger.trace(`Temperature at ${this.location}: ${temperature}`);

      if(this.humidity !== humidity && typeof this.onHumidityChange === 'function') {
        this.onHumidityChange(humidity);
      }

      this.humidity = humidity;

      if(this.temperature !== temperature && typeof this.onTemperatureChange === 'function') {
        this.onTemperatureChange(temperature);
      }

      this.temperature = temperature;
    });

    this.sensor.on('badChecksum', err => {
      this.logger.warn(`DHT22: checksum failed at ${this.location}`, err);
    });
  }

  start() {
    // this.logger.trace(`DHT22 initial read...`);
    // this.sensor.read();

    this.logger.debug(`Starting DHT22 interval (${this.interval}ms) at ${this.location}...`);

    setInterval(() => {
      this.sensor.read();
    }, this.interval);
  }
}

module.exports = DHT22;
