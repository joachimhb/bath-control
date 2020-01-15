'use strict';

const _            = require('lodash');
const check        = require('check-types');
const EventEmitter = require('eventemitter2');
const moment       = require('moment');
const millisecond  = require('millisecond');

const LightSensor  = require('./sensors/Light');
const LightControl = require('./controls/LightControl');

const DHT22              = require('./sensors/DHT22');
const HumidityControl    = require('./controls/HumidityControl');
const TemperatureControl = require('./controls/TemperatureControl');
const FanControl         = require('./controls/FanControl');

const pinConfig = require('../pinConfig');

class Control {
  constructor(params) {
    check.assert.object(params, 'params is not an object');
    check.assert.object(params.logger, 'params.logger is not an object');
    check.assert.number(params.lightTimeout, 'params.lightTimeout is not a number');
    check.assert.number(params.fanMaxMinutesRunning, 'params.fanMaxMinutesRunning is not a number');
    check.assert.number(params.trailingTime, 'params.trailingTime is not a number');
    check.assert.number(params.humidityMinThreshold, 'params.humidityMinThreshold is not a number');
    check.assert.number(params.humidityMaxThreshold, 'params.humidityMaxThreshold is not a number');
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

    this.handleLightChanged       = this.handleLightChanged.bind(this);
    this.handleHumidityChanged    = this.handleHumidityChanged.bind(this);
    this.handleTemperatureChanged = this.handleTemperatureChanged.bind(this);

    this.eventbus.on('light::changed',       this.handleLightChanged);
    this.eventbus.on('humidity::changed',    this.handleHumidityChanged);
    this.eventbus.on('temperature::changed', this.handleTemperatureChanged);
  }

  init() {
    const lightConfig = _.get(pinConfig, [this.location, 'light'], {});
    const dht22Config = _.get(pinConfig, [this.location, 'dht22'], {});
    const fanConfig   = _.get(pinConfig, [this.location, 'fan'], {});

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

    setInterval(() => {
      // just make sure all checks run after 10s
      this.checkFanControl();
    }, millisecond('10s'));
  }

  debugEvents(logger, event, data) {
    if(data) {
      logger.debug(event, data);
    } else {
      logger.debug(event);
    }
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

  checkFanControl() {
    const {
      fan,
      fanTrailing,
      fanControl,
      light,
      humidity,
      // temperature,
    } = this.status;

    const fanControlValue = fanControl.value;

    this.logger.trace(`FanControl in mode: [${fanControlValue}]`);

    if(fanControlValue === 'auto') {
      if(light.value === 'on') {
        const diffMin = moment().diff(light.since, 'minute');

        this.logger.debug(`[${this.location}]: light on since ${diffMin} min(s)`);

        if(moment().diff(light.since, 'millisecond') > millisecond(this.lightTimeout)) {
          this.logger.debug(`[${this.location}]: light timeout reached`);

          if(!fanTrailing.value) {
            this.logger.debug(`[${this.location}]: set trailing`);

            this.handleFanTrailingChanged(true);

            return false;
          }
        }
      } else if(fanTrailing.value) {
        this.logger.debug(`[${this.location}]: still trailing`);

        const diffMin = moment().diff(light.since, 'minute');

        this.logger.debug(`[${this.location}]: trailing since ${diffMin} min(s)`);

        if(moment().diff(light.since, 'millisecond') > millisecond(this.trailingTime)) {
          this.logger.debug(`[${this.location}]: stop trailing`);

          this.handleFanTrailingChanged(false);

          return false;
        }
      }

      let newFanSpeed = 'off';

      if(fanTrailing.value) {
        newFanSpeed = 'min';
      }

      const humidityValue = humidity.value;

      if(humidityValue) {
        const downToMaxThreshold = this.humidityMaxThreshold * 0.85;
        const downToMinThreshold = this.humidityMinThreshold * 0.85;

        if(humidityValue > this.humidityMaxThreshold) {
          newFanSpeed = 'max';
          this.logger.warn(`[${this.location}]: Fan - run [max] - humidity > ${this.humidityMaxThreshold}`);
        } else if(fan.value === 'max' && humidityValue > downToMaxThreshold) {
          newFanSpeed = 'max';
          // just wait...
          this.logger.warn(`[${this.location}]: Fan - keep running [max] - humidity > ${downToMaxThreshold}`);
        } else if(humidityValue > this.humidityMinThreshold) {
          newFanSpeed = 'min';
          this.logger.warn(`[${this.location}]: Fan - run [min] - humidity > ${this.humidityMinThreshold}`);
        } else if(fan.value === 'min' && humidityValue > downToMinThreshold) {
          newFanSpeed = 'min';
          // just wait...
          this.logger.warn(`[${this.location}]: Fan - keep running [min] - humidity > ${downToMinThreshold}`);
        }
      }

      if(fan.value !== newFanSpeed) {
        this.handleFanChanged(newFanSpeed);
        this.eventbus.emit(`fan::set`, {value: newFanSpeed});
      }
    } else {
      // do nothing, manually controlled
    }

    // const currentFanSpeed = fan.value;
    // const diffMin = moment().diff(moment(fan.since), 'minutes');

    // if(currentFanSpeed !== 'off') {
    //   this.logger.info(`[${this.location}]: Fan since ${diffMin} min(s) at speed [${currentFanSpeed}]`);

    //   if(diffMin >= this.fanMaxMinutesRunning) {
    //     this.hardStop = true;

    //     this.eventbus.emit(`fan::set`, {value: 'off'});

    //     this.logger.fatal(`[${this.location}]: Fan wass running more than 30 min... Checking again in 4 hours`);

    //     setTimeout(() => {
    //       this.hardStop = false;
    //     }, millisecond('4h'));

    //     return false;
    //   }
    // }
  }
}

module.exports = Control;
