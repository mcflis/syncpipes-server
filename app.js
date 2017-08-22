var gls = require('gulp-live-server');
gls('dist/server.js', undefined, false).start();
gls('dist/worker.js', undefined, false).start();