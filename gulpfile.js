var gulp = require('gulp');
var path = require('path');
var ts = require('gulp-typescript');
var del = require('del');
var runSequence = require('run-sequence');
var gls = require('gulp-live-server');
var mocha = require('gulp-mocha');
//var Service = require('node-windows').Service;

var config = {
  "buildDir":   "dist/",
  "tsOptions":  {
    "target":                 "ES6",
    "module":                 "commonjs",
    "sourceMap":              true,
    "emitDecoratorMetadata":  true,
    "experimentalDecorators": true,
    "removeComments":         false,
    "noImplicitAny":          false,
    "typescript":             require('typescript'),
    "sortOutput":             true
  },
  "files":      [
    "node_modules/reflect-metadata/reflect-metadata.d.ts",
    "node_modules/inversify-dts/inversify/inversify.d.ts",
    "typings/index.d.ts",
    "src/**/*.ts"
  ],
  "watchFiles": [
    "src/**/*.ts"
  ]
};

/* Create a new service object
var svc = new Service({
    name:'SyncPipes Server',
    description: 'SyncPipes server as a windows service.',
    script: 'app.js'
});
*/

gulp.task('default', ['build']);

/**
 * Build application
 */
gulp.task('build', function (callback) {
  runSequence('clean', 'copy', 'compile', callback);
});

/**
 * Compile typescript
 */
gulp.task('compile', function () {
  return gulp
    .src(config.files)
    .pipe(ts(config.tsOptions))
    .pipe(gulp.dest(config.buildDir));
});


/**
 * Copy non typescript files
 */
gulp.task('copy', function () {
  return gulp.src(["!src/services/**/*.ts", "src/services/**/*"], {base: './src'}).pipe(gulp.dest(config.buildDir));
});

/**
 * Delete build files
 */
gulp.task('clean', function () {
  return del(config.buildDir);
});

/**
 * Watch files and build
 */
gulp.task('watch', [ 'build' ], function () {
  gulp.watch(config.watchFiles, [ 'build' ]);
});

/**
 * Run server and worker
 */
gulp.task('serve', ['build'], function () {
  var server = gls('dist/server.js', undefined, false);
  var worker = gls('dist/worker.js', undefined, false);
  server.start();
  worker.start();
  gulp.watch(config.watchFiles, function () {
    runSequence('compile', function() {
      server.start.bind(server)();
      worker.start.bind(worker)();
    });
  });
});

/*
gulp.task('install:service', ['build'], function () {
    // Listen for the "install" event, which indicates the
    // process is available as a service.
    svc.on('install',function(){
        svc.start();
    });

    svc.on('alreadyinstalled',function(){
        console.log('This service is already installed.');
    });

    svc.on('start',function(){
        console.log(svc.name+' started!\nVisit http://127.0.0.1:3010 to see it in action.');
    });

    svc.install();
});

gulp.task('uninstall:service', ['build'], function () {
    // Listen for the "uninstall" event so we know when it's done.
    svc.on('uninstall',function(){
        console.log('Uninstall complete.');
        console.log('The service exists: ',svc.exists);
    });

    // Uninstall the service.
    svc.uninstall();
});
*/

/**
 * Invoke tests
 */
gulp.task('test', ['build'], function () {
  return gulp.src('dist/**/*.{test,spec}.js',  {read: false}).pipe(mocha());
});

gulp.task('test:services', ['build'], function () {
  return gulp.src('dist/services/**/*.{test,spec}.js',  {read: false}).pipe(mocha());
});

gulp.task('test:app', ['build'], function () {
  return gulp.src('dist/app/**/*.{test,spec}.js',  {read: false}).pipe(mocha());
});

gulp.task('test:scservice', ['build'], function () {
  return gulp.src('dist/services/scExtractor/**/*.{test,spec}.js',  {read: false}).pipe(mocha());
});