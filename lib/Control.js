'use strict';

const _            = require('lodash');
const check        = require('check-types-2');
const EventEmitter = require('eventemitter2');
const moment       = require('moment');
const ms           = require('ms');

const LightSensor  = require('./sensors/Light');
const LightControl = require('./controls/LightControl');

const DHT22              = require('./sensors/DHT22');
const HumidityControl    = require('./controls/HumidityControl');
const TemperatureControl = require('./controls/TemperatureControl');
const FanControl         = require('./controls/FanControl');

class Control {
  constructor(params) {
    check.assert.object(params, 'params is not an object');
    check.assert.object(params.logger, 'params.logger is not an object');
    check.assert.object(params.settings, 'params.settings is not an object');
    check.assert.string(params.settings.lightTimeout, 'params.settings.lightTimeout is not a string');
    check.assert.string(params.settings.trailingTime, 'params.settings.trailingTime is not a string');
    check.assert.string(params.settings.minRunTime, 'params.settings.minRunTime is not a string');
    check.assert.number(params.settings.humidityMinThreshold, 'params.settings.humidityMinThreshold is not a number');
    check.assert.number(params.settings.humidityMaxThreshold, 'params.settings.humidityMaxThreshold is not a number');
    check.assert.string(params.location, 'params.location is not a string');
    check.assert.object(params.gpios, 'params.gpios is not an object');

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

    this.status = {
      temperature: {
        // value: 21,
        since: moment()
      },
      humidity: {
        // value: 40,
        since: moment()
      },
      light: {
        value: 'off',
        since: moment()
      },
      fan: {
        value: 'off',
        since: moment()
      },
      fanControl: {
        value: 'auto',
        since: moment()
      },
      fanTrailing: {
        value: false,
        since: moment()
      },
    };

    this.eventbus.onAny((event, data) => {
      this.debugEvents(this.logger, event, data);
    });

    this.handleSettingsChanged    = this.handleSettingsChanged.bind(this);

    this.handleLightChanged       = this.handleLightChanged.bind(this);
    this.handleHumidityChanged    = this.handleHumidityChanged.bind(this);
    this.handleTemperatureChanged = this.handleTemperatureChanged.bind(this);
    this.handleFanControlChanged  = this.handleFanControlChanged.bind(this);
    this.handleFanChanged         = this.handleFanChanged.bind(this);

    this.eventbus.on('settings::changed',    this.handleSettingsChanged);
    this.eventbus.on('light::changed',       this.handleLightChanged);
    this.eventbus.on('humidity::changed',    this.handleHumidityChanged);
    this.eventbus.on('temperature::changed', this.handleTemperatureChanged);
    this.eventbus.on('fanControl::changed',  this.handleFanControlChanged);
    this.eventbus.on('fan::changed',         this.handleFanChanged);
  }

  init() {
    const lightGpio = _.get(this.gpios, ['light']);
    const dht22Gpio = _.get(this.gpios, ['dht22']);
    const fanGpios    = _.get(this.gpios, ['fan'], {});

    if(lightGpio) {
      this.lightControl = new LightControl({
        eventbus: this.eventbus,
        location: this.location,
        logger: this.logger,
        sensor: new LightSensor({
          logger: this.logger,
          location: this.location,
          gpio: lightGpio
        })
      });
    }

    if(dht22Gpio) {
      const sensor = new DHT22({
        logger: this.logger,
        location: this.location,
        gpio: dht22Gpio
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

    if(fanGpios.power && fanGpios.speed) {
      this.fanControl = new FanControl({
        eventbus: this.eventbus,
        location: this.location,
        logger: this.logger,
        powerGpio: fanGpios.power,
        speedGpio: fanGpios.speed,
        default: 'off',
      });
    }

    setInterval(() => {
      // just make sure all checks run after 10s
      this.checkFanControl();
    }, ms('10s'));
  }

  debugEvents(logger, event, data) {
    const {location} = this;

    if(data) {
      logger.trace(`[${location}]: ${event}`, data);
    } else {
      logger.trace(`[${location}]: ${event}`);
    }
  }

  handleSettingsChanged(settings) {
    const {location} = this;

    this.logger.info(`[${location}]: new settings`, settings);
    this.settings = settings;
  }

  handleStatusChange(type, value) {
    _.set(this.status, [type, 'value'], value);
    _.set(this.status, [type, 'since'], moment());
  }

  handleLightChanged({value}) {
    this.handleStatusChange('light', value);
    this.checkFanControl();
  }

  handleHumidityChanged({value}) {
    this.handleStatusChange('humidity', value);
    this.checkFanControl();
  }

  handleTemperatureChanged({value}) {
    this.handleStatusChange('temperature', value);
    this.checkFanControl();
  }

  handleFanChanged(value) {
    this.handleStatusChange('fan', value);
    this.checkFanControl();
  }

  handleFanControlChanged(value) {
    this.handleStatusChange('fanControl', value);
    this.checkFanControl();
  }

  handleFanTrailingChanged(value) {
    this.handleStatusChange('fanTrailing', value);
    this.checkFanControl();
  }

  setFan(value) {
    if(value === 'auto') {
      this.handleFanControlChanged('auto');
    } else if(['min', 'max', 'off'].includes(value)) {
      this.handleFanControlChanged('manual');
      this.eventbus.emit(`fan::set`, {value});
      this.handleFanChanged(value);
    } else {
      this.logger.error(`Unknown fan value: ${value}`);
    }
  }

  checkFanControl() {
    const {
      location,
      logger,
    } = this;

    const {
      fan,
      fanTrailing,
      fanControl,
      light,
      humidity,
      // temperature,
    } = this.status;

    const {
      trailingTime,
      lightTimeout,
      minRunTime,
      humidityMinThreshold,
      humidityMaxThreshold,
    } = this.settings;

    const fanControlValue = fanControl.value;

    logger.trace(`FanControl in mode: [${fanControlValue}]`);

    if(fanControlValue !== 'auto') {
      // do nothing, manually controlled
      return null;
    }

    if(light.value === 'on') {
      const diffMin = moment().diff(light.since, 'minute');

      logger.debug(`[${location}]: light on since ${diffMin} min(s)`);

      if(moment().diff(light.since, 'millisecond') > ms(lightTimeout)) {
        logger.debug(`[${location}]: light timeout reached`);

        if(!fanTrailing.value) {
          logger.debug(`[${location}]: set trailing`);

          this.handleFanTrailingChanged(true);

          return false;
        }
      }
    } else if(fanTrailing.value) {
      logger.debug(`[${location}]: still trailing`);

      const diffMin = moment().diff(light.since, 'minute');

      logger.debug(`[${location}]: trailing since ${diffMin} min(s)`);

      if(moment().diff(light.since, 'millisecond') > ms(trailingTime)) {
        logger.debug(`[${location}]: stop trailing`);

        this.handleFanTrailingChanged(false);

        return false;
      }
    }

    // fan should run at same speed for a minimum time
    if(moment().diff(fan.since, 'millisecond') < ms(minRunTime)) {
      return false;
    }

    let newFanSpeed = 'off';

    if(fanTrailing.value) {
      newFanSpeed = 'min';
    }

    const humidityValue = humidity.value;

    if(humidityValue) {
      const downToMinThreshold = humidityMinThreshold - 5;
      const downToMaxThreshold = humidityMaxThreshold - 10;

      if(humidityValue > humidityMaxThreshold) {
        newFanSpeed = 'max';
        logger.warn(`[${location}]: Fan - run [max] - humidity > ${humidityMaxThreshold}`);
      } else if(fan.value === 'max' && humidityValue > downToMaxThreshold) {
        newFanSpeed = 'max';
        // just wait...
        logger.warn(`[${location}]: Fan - keep running [max] - humidity > ${downToMaxThreshold}`);
      } else if(humidityValue > humidityMinThreshold) {
        newFanSpeed = 'min';
        logger.warn(`[${location}]: Fan - run [min] - humidity > ${humidityMinThreshold}`);
      } else if(fan.value === 'min' && humidityValue > downToMinThreshold) {
        newFanSpeed = 'min';
        // just wait...
        logger.warn(`[${location}]: Fan - keep running [min] - humidity > ${downToMinThreshold}`);
      }
    }

    if(fan.value !== newFanSpeed) {
      this.eventbus.emit(`fan::set`, {value: newFanSpeed});
      this.handleFanChanged(newFanSpeed);
    }
  }
}

module.exports = Control;
