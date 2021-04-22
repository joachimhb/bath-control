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

let config = null;

const dockerConfigPath = '../config/bathControl';
const localConfigPath = '../smart-home-setup/kammer/config/bathControl';

try {
  config = require(dockerConfigPath);
  logger.info(`Using config [${dockerConfigPath}]`);
} catch(err) {
  config = require(localConfigPath);
  logger.info(`Using config [${localConfigPath}]`);
}

const started = moment();

const defaultSettings = {
  trailingTime: '3m',
  lightTimeout: '3m',
  minRunTime: '1m',
  humidityMinThreshold: 75,
  humidityMaxThreshold: 90,
  fanDefault: 'off',
};

const valueKeys = [
  'temperature',
  'humidity',
  'light',
  'fan',
  'fanControl',
];

const units = {
  temperature: 'C',
  humidity: '%',
};

const labels = {
  temperature: 'Temperatur',
  humidity: 'Luftfeuchtigkeit',
  light: 'Licht',
  fan: 'Lüfter',
  fanControl: 'Control',
  bath: 'Bad',
  wc: 'WC',
};

logger.info(`Initializing...`);

const locations = {
  bath: new Control({
    logger,
    location: 'bath',
    pins: config.bath.pins,
    settings: defaultSettings,
  }),
  wc: new Control({
    logger,
    location: 'wc',
    pins: config.wc.pins,
    settings: defaultSettings,
  }),
};

locations.bath.init();

logger.info(`BathControl initialized`);

locations.wc.init();

logger.info(`WcControl initialized`);

const app = express();

app.use(bodyParser.json());

app.use(express.urlencoded({
  extended: true
}));

app.engine('handlebars', exphbs());
app.set('view engine', 'handlebars');

const getStatus = function() {
  const momentFormat = 'YYYY-MM-DD HH:mm:ss';

  const status = {
    main: {
      started: started.format(momentFormat)
    },
    locations: {},
  };

  for(const location of Object.keys(locations)) {
    for(const valueKey of valueKeys) {
      status.locations[location] = status.locations[location] || {
        values: {},
      };

      const valueObj = _.get(locations[location], ['status', valueKey], {});

      status.locations[location].values[valueKey] = {
        value: valueObj.value,
        since: valueObj.since ? moment(valueObj.since).format(momentFormat) : 'unbekannt'
      };
    }

    Object.assign(status.locations[location], {
      setAutoLink: `${location}/fan/auto`,
      setOffLink: `${location}/fan/off`,
      setMinLink: `${location}/fan/min`,
      setMaxLink: `${location}/fan/max`,
      settings: locations[location].settings,
    });
  }

  return status;
};

app.get('/', (req, res) => {
  const status = getStatus();

  res.render('status', {labels, units, status});
});

app.get('/raw/status', (req, res) => {
  const status = getStatus();

  res.json(status);
});

app.set('json spaces', 2);

app.post('/settings/:location', (req, res) => {
  const {location} = req.params;

  locations[location].eventbus.emit(`settings::changed`, req.body);

  setTimeout(() => {
    res.redirect('/');
  }, 250);
});

// eslint-disable-next-line no-unused-vars
app.get('/:location/fan/:value', (req, res, next) => {
  const {location, value} = req.params;

  logger.info(`Fan change: ${location} to ${value}`);

  locations[location].setFan(value);

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
