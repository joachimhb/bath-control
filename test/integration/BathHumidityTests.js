const assert = require('assertthat');
const log4js = require('log4js');

const BathControl = require('../../lib/BathControl');

const logger = log4js.getLogger();

logger.level = 'info';

const lightTimeout = 100;
const trailingTime = 300;

const bathControl = new BathControl({
  logger,
  lightTimeout,
  trailingTime
});

// suite('Bath Humidity', () => {
//   test('Bath HumidityThreshold reached', done => {
//     bathControl.eventbus.once('fancontrol::updated', fanControl => {
//       assert.that(fanControl.speed).is.equalTo(100);
//       assert.that(fanControl.bath).is.equalTo(90);
//       assert.that(fanControl.wc).is.equalTo(10);

//       done();
//     });

//     bathControl.bathBht22.humidityChanged(70);
//   });
// });

