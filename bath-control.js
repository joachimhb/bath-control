'use strict';

const http = require('http');
const fs   = require('fs');

const _          = require('lodash');
const log4js     = require('log4js');
const express    = require('express');
const exphbs     = require('express-handlebars');
const moment     = require('moment');
const bodyParser = require('body-parser');

const logger = log4js.getLogger();

logger.level = 'info';
logger.level = 'debug';

const lockFilePath = '/var/run/pigpio.pid';

try {
  // eslint-disable-next-line no-sync
  const stats = fs.statSync(lockFilePath);

  if(stats) {
    // eslint-disable-next-line no-sync
    fs.unlinkSync(lockFilePath);

    logger.warn(`Deleted lockfile [${lockFilePath}]`);
  }
} catch(error) {
  if(error.code !== 'ENOENT') {
    logger.error(`Failed to cleanup lockfile [${lockFilePath}]`, error);
  }
}

const Control = require('./lib/Control');

const config = require('../config/bathControl');

logger.info(`Initializing...`);

const bathControl = new Control({
  logger,
  location: 'bath',
  pins: config.bath.pins,
  ...config.bath.settings,
});

const wcControl = new Control({
  logger,
  location: 'wc',
  pins: config.wc.pins,
  ...config.wc.settings,
});

bathControl.init();

logger.info(`BathControl initialized`);

wcControl.init();

logger.info(`WcControl initialized`);

const app = express();

app.use(bodyParser.json());

app.engine('handlebars', exphbs());
app.set('view engine', 'handlebars');

const started = moment();

app.get('/', (req, res) => {
  const bathTemp = _.get(bathControl.status, ['temperature'], {});
  const bathHumidity = _.get(bathControl.status, ['humidity'], {});
  const bathLight = _.get(bathControl.status, ['light'], {});
  const bathFan = _.get(bathControl.status, ['fan'], {});
  const bathFanControl = _.get(bathControl.status, ['fanControl'], {});

  const wcTemp = _.get(wcControl.status, ['temperature'], {});
  const wcHumidity = _.get(wcControl.status, ['humidity'], {});
  const wcLight = _.get(wcControl.status, ['light'], {});
  const wcFan = _.get(wcControl.status, ['fan'], {});
  const wcFanControl = _.get(wcControl.status, ['fanControl'], {});

  const momentFormat = 'YYYY-MM-DD HH:mm:ss';

  const status = {
    main: {
      started: started.format(momentFormat)
    },
    bath: {
      temperature: {
        value: bathTemp.value,
        since: bathTemp.since ? moment(bathTemp.since).format(momentFormat) : 'unbekannt'
      },
      humidity: {
        value: bathHumidity.value,
        since: bathHumidity.since ? moment(bathHumidity.since).format(momentFormat) : 'unbekannt'
      },
      light: {
        value: bathLight.value,
        since: bathLight.since ? moment(bathLight.since).format(momentFormat) : 'unbekannt'
      },
      fan: {
        value: bathFan.value,
        since: bathFan.since ? moment(bathFan.since).format(momentFormat) : 'unbekannt'
      },
      control: {
        value: bathFanControl.value,
        since: bathFanControl.since ? moment(bathFanControl.since).format(momentFormat) : 'unbekannt',
        setAutoLink: 'bath/fan/auto',
        setOffLink: 'bath/fan/off',
        setMinLink: 'bath/fan/min',
        setMaxLink: 'bath/fan/max',
      }
    },
    wc: {
      temperature: {
        value: wcTemp.value,
        since: wcTemp.since ? moment(wcTemp.since).format(momentFormat) : 'unbekannt'
      },
      humidity: {
        value: wcHumidity.value,
        since: wcHumidity.since ? moment(wcHumidity.since).format(momentFormat) : 'unbekannt'
      },
      light: {
        value: wcLight.value,
        since: wcLight.since ? moment(wcLight.since).format(momentFormat) : 'unbekannt'
      },
      fan: {
        value: wcFan.value,
        since: wcFan.since ? moment(wcFan.since).format(momentFormat) : 'unbekannt'
      },
      control: {
        value: wcFanControl.value,
        since: wcFanControl.since ? moment(wcFanControl.since).format(momentFormat) : 'unbekannt',
        setAutoLink: 'wc/fan/auto',
        setOffLink: 'wc/fan/off',
        setMinLink: 'wc/fan/min',
        setMaxLink: 'wc/fan/max',
      }
    }
  };

  // console.log(status);

  res.render('status', status);
});

app.set('json spaces', 2);

// eslint-disable-next-line no-unused-vars
app.get('/:location/fan/:value', (req, res, next) => {
  const {location, value} = req.params;

  logger.info(`Fan change: ${location} to ${value}`);

  if(location === 'bath') {
    bathControl.setFan(value);
  } else if(location === 'wc') {
    wcControl.setFan(value);
  }

  setTimeout(() => {
    res.redirect('/');
  }, 250);
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error(err.message);
});

const {port} = config;

const server = http.createServer(app);

server.on('error', err => {
  logger.error('Server error', err);
});

server.listen(port);

logger.info(`Server started at ${port}`);
