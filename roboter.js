const roboter = require('roboter');

roboter
  .workOn('server')
  .equipWith(task => {
    task('universal/license', {
      compatible: [
        'MIT',
        'MIT*',
        'MIT Licensed. http://www.opensource.org/licenses/mit-license.php',
        'MIT/X11',
        'ISC',
        'BSD',
        'BSD*',
        'BSD-2-Clause',
        'BSD-3-Clause',
        'BSD-like',
        'Apache-2.0',
        'Apache-2.0*',
        'LGPL-2.1+',
        'Public Domain',

        'CC-BY-4.0',
        '(MIT OR Apache-2.0)',

        '(MIT AND JSON)',

        '(MIT AND CC-BY-3.0)',
        'BSD-3-Clause OR MIT',
        '(WTFPL OR MIT)',
        '(GPL-2.0 OR MIT)',

        'WTFPL',
        'UNKNOWN',
        'Unlicense'
      ]
    });

    task('universal/analyze', {
      src: ['src/**/*.js', 'lib/**/*.js', 'test/**/*.js'],
      rules: '.eslintrc.json'
    });

    task('universal/test-units', {
      babelize: true,
      src: ['test/units/**/*Tests.js']
    });

    task('universal/unused-dependencies', {
      exclude: ['**']
    });
  })
  .start();
