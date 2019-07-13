const _ = require('lodash');

const check = require('check-types');

const EventEmitter = require('eventemitter2');

const LightSensor = require('./sensors/Light');
const LightControl = require('./controls/LightControl');

const DHT22 = require('./sensors/DHT22');
const HumidityControl = require('./controls/HumidityControl');
const TemperatureControl = require('./controls/TemperatureControl');

const FanControl = require('./controls/FanControl');

const pinConfig = require('../pinConfig');

class BathControl {
  constructor(params) {
    check.assert.object(params, 'params is not an object');
    check.assert.object(params.logger, 'params.logger is not an object');
    check.assert.number(params.lightTimeout, 'params.lightTimeout is not a number');
    check.assert.number(params.trailingTime, 'params.trailingTime is not a number');
    check.assert.number(params.humidityThreshold, 'params.humidityThreshold is not a number');
    check.assert.string(params.location, 'params.location is not a string');

    Object.assign(this, params);

    this.eventbus = new EventEmitter({
      wildcard: true,
      //
      // the delimiter used to segment namespaces, defaults to `.`.
      //
      delimiter: '::',
      //
      // the maximum amount of listeners that can be assigned to an event, default 10.
      //
      maxListeners: 20,
      //
      // show event name in memory leak message when more than maximum amount of listeners is assigned, default false
      //
      verboseMemoryLeak: false
    });

    this.status = {};
    this.trailing = {};
    this.eventbus.onAny((event, data) => {
      this.debugEvents(this.logger, event, data);
    });

    this.handleLightChanged        = this.handleLightChanged.bind(this);
    this.handleHumidityChanged     = this.handleHumidityChanged.bind(this);
    this.handleTemperatureChanged  = this.handleTemperatureChanged.bind(this);

    this.eventbus.on('light::changed', this.handleLightChanged);
    this.eventbus.on('humidity::changed', this.handleHumidityChanged);
    this.eventbus.on('temperature::changed', this.handleTemperatureChanged);
  }

  init() {
    const lightConfig = _.get(pinConfig, [this.location, 'light'], {});
    const dht22Config = _.get(pinConfig, [this.location, 'dht22'], {});
    const fanConfig = _.get(pinConfig, [this.location, 'fan'], {});

    if(lightConfig.pin) {
      this.lightControl = new LightControl({
        eventbus: this.eventbus,
        location: this.location,
        logger: this.logger,
        sensor: new LightSensor({
          logger: this.logger,
          location: this.location,
          pin: lightConfig.pin
        })
      });
    }

    if(dht22Config.gpio) {
      const sensor = new DHT22({
        logger: this.logger,
        location: this.location,
        gpio: dht22Config.gpio
      });

      this.humidityControl = new HumidityControl({
        eventbus: this.eventbus,
        location: this.location,
        logger: this.logger,
        sensor
      });

      this.temperatureControl = new TemperatureControl({
        eventbus: this.eventbus,
        location: this.location,
        logger: this.logger,
        sensor
      });
    }

    if(fanConfig.power && fanConfig.speed) {
      this.fanControl = new FanControl({
        eventbus: this.eventbus,
        location: this.location,
        logger: this.logger,
        powerPin: fanConfig.power,
        speedPin: fanConfig.speed
      });
    }
  }

  debugEvents(logger, event, data) {
    if(data) {
      logger.debug(event, data);
    } else {
      logger.debug(event);
    }
  }

  handleSensorValueChanged(type, value) {
    _.set(this.status, [type, 'value'], value);
    _.set(this.status, [type, 'since'], new Date());
  }

  handleLightChanged({value}) {
    this.handleSensorValueChanged('light', value);

    if(value) {
      this.lightTimer = setTimeout(() => {
        this.trailing = true;

        this.updateFanControl();
      }, this.lightTimeout);
    } else if(this.trailing) {
      this.fanTrailingTimer = setTimeout(() => {
        this.trailing = false;

        this.updateFanControl();
      }, this.trailingTime);
    } else if(this.lightTimer) {
      clearTimeout(this.lightTimer);
    }
  }

  handleHumidityChanged({value}) {
    this.handleSensorValueChanged('humidity', value);
    this.updateFanControl();
  }

  handleTemperatureChanged({value}) {
    this.handleSensorValueChanged('temperature', value);
    this.updateFanControl();
  }

  updateFanControl() {
    const humidity = _.get(this.status, ['humidity', 'value'], 0);

    if(humidity > this.humidityThreshold) {
      this.eventbus.emit(`fan::set`, {value: 'max'});
    } else if(this.trailing) {
      this.eventbus.emit(`fan::set`, {value: 'min'});
    } else {
      this.eventbus.emit(`fan::set`, {value: 'off'});
    }
  }
}

module.exports = BathControl;
