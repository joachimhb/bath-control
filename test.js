const rpio = require('rpio');

const powerPin = 12;

rpio.open(powerPin, rpio.OUTPUT, rpio.LOW);
rpio.write(powerPin, rpio.HIGH);

setTimeout(() => {
  rpio.write(powerPin, rpio.LOW);
}, 1000);
