const assert = require('assertthat');
const log4js = require('log4js');

const BathControl = require('../../lib/BathControl');

const logger = log4js.getLogger();

logger.level = 'info';

const lightTimeout = 500;
const trailingTime = 500;

let bathControl;

suite('Bath Light Timeout', () => {
  setup(() => {
    bathControl = new BathControl({
      logger,
      lightTimeout,
      trailingTime
    });
  });

  test('Bath Light Switched ON / OFF', done => {
    assert.that(bathControl.fanControl.speed).is.equalTo(0);
    assert.that(bathControl.fanControl.bath).is.equalTo(0);
    assert.that(bathControl.fanControl.wc).is.equalTo(0);

    let started = false,
        stopped = false;

    bathControl.eventbus.once('bath::light::timeout::reached', () => {
      done(new Error('Timeout must not be reached'));
    });

    bathControl.eventbus.once('bath::light::timeout::started', () => {
      started = true;

      bathControl.bathLightControl.changed(false);
    });

    bathControl.eventbus.once('bath::light::timeout::stopped', () => {
      stopped = true;

      assert.that(started).is.true();
      assert.that(stopped).is.true();

      done();
    });

    bathControl.bathLightControl.changed(true);
  });

  test('Bath Light Switched ON / TIMEOUT / OFF', done => {
    assert.that(bathControl.fanControl.speed).is.equalTo(0);
    assert.that(bathControl.fanControl.bath).is.equalTo(0);
    assert.that(bathControl.fanControl.wc).is.equalTo(0);

    let reached = false,
        started = false,
        stopped = false;

    bathControl.eventbus.once('bath::light::timeout::started', () => {
      started = true;
    });

    bathControl.eventbus.once('bath::light::timeout::reached', () => {
      reached = true;
    });

    bathControl.eventbus.on('fancontrol::updated', fanControl => {
      if(started && reached && stopped) {
        assert.that(fanControl.speed).is.equalTo(0);

        return done();
      } else if(started && reached) {
        assert.that(fanControl.speed).is.equalTo(50);

        bathControl.eventbus.once('bath::light::timeout::stopped', () => {
          stopped = true;
        });

        bathControl.bathLightControl.changed(false);
      } else {
        assert.that(fanControl.speed).is.equalTo(0);
      }
    });

    bathControl.bathLightControl.changed(true);
  });
});
