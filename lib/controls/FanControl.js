const rpio = require('rpio');
const check = require('check-types');

class FanControl {
  constructor(params) {
    check.assert.object(params, 'params is not an object');
    check.assert.object(params.logger, 'params.logger is not an object');
    check.assert.object(params.eventbus, 'params.eventbus is not an object');
    check.assert.string(params.location, 'params.location is not a string');
    check.assert.number(params.powerPin, 'params.powerPin is not a number');
    check.assert.number(params.speedPin, 'params.speedPin is not a number');

    Object.assign(this, params);

    this.updateFan = this.updateFan.bind(this);

    this.logger.info(`Initiated FanControl at ${this.location} on pins: power[${this.powerPin}] / speed[${this.speedPin}]`);

    this.showPinStatistics();

    // rpio.open(this.powerPin, rpio.INPUT);
    // rpio.open(this.speedPin, rpio.INPUT);

    rpio.open(this.powerPin, rpio.OUTPUT, rpio.LOW);
    rpio.open(this.speedPin, rpio.OUTPUT, rpio.LOW);

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

    // rpio.open(this.powerPin, rpio.OUTPUT);
    rpio.write(this.powerPin, rpio.HIGH);

    this.showPinStatistics();
  }

  setFanStop() {
    if(this.isFanRunning()) {
      this.running = false;

      console.log('set stop')
      // rpio.open(this.powerPin, rpio.OUTPUT);
      rpio.write(this.powerPin, rpio.LOW);
      rpio.write(this.speedPin, rpio.LOW);

      this.showPinStatistics();
    }
  }

  setFanMin() {
    if(!this.isFanRunning()) {
      console.log('set running')
      this.setFanRunning();
    }

    console.log('set min')

    rpio.write(this.speedPin, rpio.LOW);
  }

  setFanMax() {
    if(!this.isFanRunning()) {
      console.log('set running')
      this.setFanRunning();
    }

    console.log('set max')

    rpio.write(this.speedPin, rpio.HIGH);
  }

  showPinStatistics() {
    // this.logger.info(`Pin ${this.powerPin} is currently ${(rpio.read(this.powerPin) ? 'high' : 'low')}`);
    // this.logger.info(`Pin ${this.speedPin} is currently ${(rpio.read(this.speedPin) ? 'high' : 'low')}`);
  }
}

module.exports = FanControl;
