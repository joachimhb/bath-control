'use strict';

const http = require('http');

const _ = require('lodash');
const log4js = require('log4js');
const express = require('express');
const ms = require('ms');
const bodyParser = require('body-parser');

const Control = require('./lib/Control');

const logger = log4js.getLogger();

logger.level = 'info';
logger.level = 'debug';

// logger.info(`Initializing...`);

const bathControl = new Control({
  logger,
  location: 'bath',
  trailingTime: ms('2m'),
  lightTimeout: ms('1m'),
  humidityMinThreshold: 70,
  humidityMaxThreshold: 80,
  fanMaxMinutesRunning: 30,
});

const wcControl = new Control({
  logger,
  location: 'wc',
  trailingTime: ms('2m'),
  lightTimeout: ms('1m'),
  humidityMinThreshold: 70,
  humidityMaxThreshold: 80,
  fanMaxMinutesRunning: 30,
});

// setInterval(() => {
//   logger.debug(bathControl.fanControl);
// }, 1000);

bathControl.init();

logger.info(`BathControl initialized`);

wcControl.init();

logger.info(`WcControl initialized`);

const app = express();

app.use(bodyParser.json());

app.set('json spaces', 2);

// eslint-disable-next-line no-unused-vars
app.get('/status', (req, res, next) => {
  const bathTemp = _.get(bathControl.status, ['bath', 'temperature'], {});
  const bathHumidity = _.get(bathControl.status, ['bath', 'humidity'], {});
  const bathLight = _.get(bathControl.status, ['bath', 'light'], {});

  const wcTemp = _.get(wcControl.status, ['wc', 'temperature'], {});
  const wcHumidity = _.get(wcControl.status, ['wc', 'humidity'], {});
  const wcLight = _.get(wcControl.status, ['wc', 'light'], {});

  const human = {
    Bad: {
      Temperatur: bathTemp.since ? `${bathTemp.value}C seit ${bathTemp.since.toLocaleTimeString()}` : 'unbekannt',
      Luftfeuchtigkeit: bathHumidity.since ? `${bathHumidity.value}% seit ${bathHumidity.since.toLocaleTimeString()}` : 'unbekannt',
      Licht: bathLight.since ? `${bathLight.value === 'on' ? 'an' : 'aus'} seit ${bathLight.since.toLocaleTimeString()}` : 'unbekannt'
    },
    WC: {
      Temperatur: wcTemp.since ? `${wcTemp.value}C seit ${wcTemp.since.toLocaleTimeString()}` : 'unbekannt',
      Luftfeuchtigkeit: wcHumidity.since ? `${wcHumidity.value}% seit ${wcHumidity.since.toLocaleTimeString()}` : 'unbekannt',
      Licht: wcLight.since ? `${wcLight.value === 'on' ? 'an' : 'aus'} seit ${wcLight.since.toLocaleTimeString()}` : 'unbekannt'
    }
  };

  res.json(human);
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error(err.message);
});

const port = 3000;

const server = http.createServer(app);

server.on('error', err => {
  logger.error('Server error', err);
});

server.listen(port);

logger.info(`Server started at ${port}`);
