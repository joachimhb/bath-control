'use strict';

const rpio  = require('rpio');
const check = require('check-types');

class FanControl {
  constructor(params) {
    check.assert.object(params, 'params is not an object');
    check.assert.object(params.logger, 'params.logger is not an object');
    check.assert.object(params.eventbus, 'params.eventbus is not an object');
    check.assert.string(params.location, 'params.location is not a string');
    check.assert.number(params.powerGpio, 'params.powerGpio is not a number');
    check.assert.number(params.speedGpio, 'params.speedGpio is not a number');

    Object.assign(this, params);

    this.updateFan = this.updateFan.bind(this);

    this.logger.info(`Initiated FanControl at [${this.location}] on gpios: power[${this.powerGpio}] / speed[${this.speedGpio}]`);


    // this.value = 'off';

    // rpio.open(this.powerGpio, rpio.INPUT);
    // rpio.open(this.speedGpio, rpio.INPUT);

    rpio.open(this.powerGpio, rpio.OUTPUT, rpio.HIGH);
    rpio.open(this.speedGpio, rpio.OUTPUT, rpio.HIGH);

    this.showGpioStatistics();

    this.updateFan({value: params.default || 'off'});

    this.eventbus.on('fan::set', this.updateFan);
  }

  updateFan({value}) {
    const {location} = this;

    if(this.value !== value) {
      this.logger.info(`FanControl.updateFan at ${location} from ${this.value} to ${value}`);
      this.value = value;

      if(value === 'off') {
        this.setFanStop();
      } else if(value === 'min') {
        this.setFanMin();
      } else if(value === 'max') {
        this.setFanMax();
      }
    }
  }

  isFanRunning() {
    return this.running;
  }

  setFanRunning() {
    this.running = true;

    // rpio.open(this.powerGpio, rpio.OUTPUT);
    rpio.write(this.powerGpio, rpio.LOW);

    this.showGpioStatistics();
  }

  setFanStop() {
    if(this.isFanRunning()) {
      this.running = false;

      // rpio.open(this.powerGpio, rpio.OUTPUT);
      rpio.write(this.powerGpio, rpio.HIGH);
      rpio.write(this.speedGpio, rpio.HIGH);

      this.showGpioStatistics();
    }
  }

  setFanMin() {
    if(!this.isFanRunning()) {
      this.setFanRunning();
    }

    rpio.write(this.speedGpio, rpio.HIGH);
  }

  setFanMax() {
    if(!this.isFanRunning()) {
      this.setFanRunning();
    }

    rpio.write(this.speedGpio, rpio.LOW);
  }

  showGpioStatistics() {
    this.logger.info(`Gpio ${this.powerGpio} (Power) is currently ${(rpio.read(this.powerGpio) ? 'high' : 'low')}`);
    this.logger.info(`Gpio ${this.speedGpio} (Speed) is currently ${(rpio.read(this.speedGpio) ? 'high' : 'low')}`);
  }
}

module.exports = FanControl;
