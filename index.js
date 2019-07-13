const http = require('http');

const _ = require('lodash');
const log4js = require('log4js');
const express = require('express');
const ms = require('ms');
const bodyParser = require('body-parser');

const Control = require('./lib/Control');

const logger = log4js.getLogger();

logger.level = 'info';
// logger.level = 'debug';

// logger.info(`Initializing...`);

const bathControl = new Control({
  logger,
  location: 'bath',
  trailingTime: ms('20s'),
  lightTimeout: ms('10s'),
  humidityThreshold: 60
});

// setInterval(() => {
//   logger.debug(bathControl.fanControl);
// }, 1000);

bathControl.init();

logger.info(`BathControl initialized`);

const app = express();

app.use(bodyParser.json());

app.set('json spaces', 2);

// eslint-disable-next-line no-unused-vars
app.get('/status', (req, res, next) => {
  const bathTemp = _.get(bathControl.status, ['bath', 'temperature'], {});
  const bathHumidity = _.get(bathControl.status, ['bath', 'humidity'], {});
  const bathLight = _.get(bathControl.status, ['bath', 'light'], {});

  const human = {
    Bad: {
      Temperatur: bathTemp.since ? `${bathTemp.value}C seit ${bathTemp.since.toLocaleTimeString()}` : 'unbekannt',
      Luftfeuchtigkeit: bathHumidity.since ? `${bathHumidity.value}% seit ${bathHumidity.since.toLocaleTimeString()}` : 'unbekannt',
      Licht: bathLight.since ? `${bathLight.value ? 'an' : 'aus'} seit ${bathLight.since.toLocaleTimeString()}` : 'unbekannt'
    }
  };

  res.json(human);
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error(err.message);
});

const port = 9090;

const server = http.createServer(app);

server.on('error', err => {
  logger.error('Server error', err);
});

server.listen(port);

logger.info(`Server started at ${port}`);
