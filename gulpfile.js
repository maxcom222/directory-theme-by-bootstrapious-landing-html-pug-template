const gulp = require('gulp');

const autoprefixer = require('gulp-autoprefixer'),
    bs = require('browser-sync').create(),
    cached = require('gulp-cached'),
    chalk = require('chalk'),
    changed = require('gulp-changed'),
    cleanCSS = require('gulp-clean-css'),
    del = require('del'),
    filter = require('gulp-filter'),
    fs = require('fs'),
    gulpif = require('gulp-if'),
    npmDist = require('gulp-npm-dist'),
    path = require('path'),
    plumber = require("gulp-plumber"),
    print = require('gulp-print').default,
    pugInheritance = require('gulp-pug-inheritance'),
    pug = require('gulp-pug'),
    rename = require('gulp-rename'),
    sass = require('gulp-sass'),
    sourcemaps = require('gulp-sourcemaps');

var srcHtmlFiles = 'html/**/*.html'
var srcPugFiles = 'pug/**/*.pug'
var srcSassFiles = 'scss/style.default.scss'

var distDevDir = 'dist/'
var distBuildDir = 'build/'
var distDevStyleDir = 'dist/css/'
var distBuildStyleDir = 'build/css/'

var distDevVendorDir = 'dist/vendor/'
var distBuildVendorDir = 'build/vendor/'

var copy = ['js/**', 'img/**', 'fonts/**', 'css/custom.css', 'favicon.png', 'icons/**', 'docs/**']


var config = {
    autoprefixer: {
        cascade: false
    },
    browserSync: {
        enabled: true
    },
    sass: {
        outputStyle: 'expanded',
        includePaths: ['src/scss']
    },
    pug: {
        locals: {
            styleSwitcher: false,
            restaurantsJson: JSON.parse(fs.readFileSync('./pug/js/restaurants-geojson.json', {
                encoding: 'utf8'
            })),
            roomsJson: JSON.parse(fs.readFileSync('./pug/js/rooms-geojson.json', {
                encoding: 'utf8'
            })),
            bookingsJson: JSON.parse(fs.readFileSync('./pug/js/bookings.json', {
                encoding: 'utf8'
            })),
        }
    }
}

// Clean the build folder - for clean builds
gulp.task('clean', function () {
    return del([
        distMainDir + '**/*'
    ]);
});


// Process changed HTML
gulp.task('html', function () {
    return gulp.src(srcHtmlFiles)

        // only pass changed files
        .pipe(changed(distMainDir))

        .pipe(print(filepath => `Processing: ${filepath}`))

        //save all the files
        .pipe(gulp.dest(distMainDir));

});

// Process Pug files
gulp.task('pug', function () {
    return gulp.src(srcPugFiles)

        //only pass unchanged *main* files and *all* the partials
        .pipe(changed(distMainDir, {
            extension: '.html'
        }))

        //filter out unchanged partials, but it only works when watching
        .pipe(cached('pug'))

        .pipe(plumber())

        .pipe(print(filepath => `Processing: ${filepath}`))

        .pipe(gulpif(global.isWatching,
            pugInheritance({
                basedir: 'pug'
            })
        ))

        //filter out partials (in pug includes)
        .pipe(filter(['**', '!pug/_pug-includes/*']))

        //process pug templates
        .pipe(pug({
            pretty: true,
            locals: config.pug.locals
        }))

        //save all the files
        .pipe(gulp.dest(distMainDir));

});

// Dev SASS Task - no sourcemaps, no autoprefixing, no minification
gulp.task('sass-dev', function () {
    return gulp.src(srcSassFiles)
        .pipe(sass(config.sass).on('error', sass.logError))
        .pipe(gulp.dest(distStyleDir));
});


// Build SASS Task - sourcemaps,autoprefixing, minification
gulp.task('sass-build', function () {
    return gulp.src(srcSassFiles)
        .pipe(sourcemaps.init())
        .pipe(sass(config.sass).on('error', sass.logError))
        .pipe(autoprefixer(config.autoprefixer))
        .pipe(gulp.dest(distStyleDir))
        .pipe(cleanCSS())
        .pipe(rename({
            suffix: '.min'
        }))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest(distStyleDir));
});

// Copy folders defined in copy array
gulp.task('copy', function () {
    return getFoldersSrc('html', copy)
        .pipe(changed(distMainDir))
        .pipe(gulp.dest(distMainDir));

});

// Copy folders defined in copy array
gulp.task('copy-pug', function () {
    return getFoldersSrc('pug', copy)
        .pipe(changed(distMainDir))
        .pipe(gulp.dest(distMainDir));

});

// Copy 3rd party modules to the vendor directory based on our package.json dependencies
// If running in dev mode w/ Browser Sync, there is no watcher set for this, it executes
// only when calling initial `gulp` command or you run `gulp vendor` separately
gulp.task('vendor', function () {
    return gulp.src(npmDist({
            copyUnminified: true
        }), {
            base: './node_modules/'
        })
        .pipe(rename(function (path) {
            path.dirname = path.dirname.replace(/\/distribute/, '').replace(/\\distribute/, '').replace(/\/dist/, '').replace(/\\dist/, '');
        }))
        .pipe(gulp.dest(distVendorDir));
});


// Dev Gulp Task - Pug = Default Gulp Task 
// 1. Process Pug, vendor dir, SCSS and copy static assets
// 2. Init Browser Sync 
// 3. Watch SCSS files, HTML files and static assets
gulp.task('default', gulp.series(
    setDev,
    gulp.parallel('pug', 'vendor', 'sass-dev', 'copy-pug'),
    serve,
    watchPug));

// Dev Gulp Task - HTML
// 1. Process HTML, vendor dir, SCSS and copy static assets
// 2. Init Browser Sync 
// 3. Watch SCSS files, HTML files and static assets
gulp.task('dev-html', gulp.series(
    setDev,
    gulp.parallel('html', 'vendor', 'sass-dev', 'copy'),
    serve,
    watch));

// Build Gulp Task - Pug
// 1. Process HTML, vendor dir, SCSS and copy static assets
// 2. Init Browser Sync 
// 3. Watch SCSS files, HTML files and static assets
gulp.task('build', gulp.series(
    setBuild,
    'clean',
    gulp.parallel('vendor', 'pug', 'sass-build', 'copy-pug')));

// Build Gulp Task - HTML
// 1. Clean dist folder
// 2. Process HTML, vendor dir, SCSS w/ source maps and minification and copy static assets
gulp.task('build-html', gulp.series(
    setBuild,
    'clean',
    gulp.parallel('vendor', 'html', 'sass-build', 'copy')));


// Helper functions

function setDev(done) {

    distMainDir = distDevDir;
    distVendorDir = distDevVendorDir;
    distStyleDir = distDevStyleDir;

    console.log(distMainDir);

    done();
}

function setBuild(done) {

    distMainDir = distBuildDir;
    distVendorDir = distBuildVendorDir;
    distStyleDir = distBuildStyleDir;

    done();
}

function reload(done) {
    bs.reload();
    done();
}

function serve(done) {
    bs.init({
        server: {
            baseDir: distMainDir
        },
        files: [
            distStyleDir + '*.css'
        ]
    });
    done();
}

function watch(done) {

    gulp.watch("scss/**/*.scss", gulp.series('sass-dev'));
    gulp.watch("html/**/*.html", gulp.series('html', reload));
    gulp.watch(getFolders('html', copy), gulp.series('copy', reload));

    console.log(chalk.yellow('Now watching HTML files for changes...'));

    setWatch();

    done();
}

function watchPug(done) {

    gulp.watch("scss/**/*.scss", gulp.series('sass-dev'));
    gulp.watch("pug/**/*.pug", gulp.series('pug', reload));
    gulp.watch(getFolders('pug', copy), gulp.series('copy-pug', reload));

    console.log(chalk.yellow('Now watching Pug files for changes...'));

    setWatch();

    done();
}

function setWatch() {
    global.isWatching = true;
}

function getFolders(base, folders) {
    return folders.map(function (item) {
        return path.join(base, item);
    });
};

function getFoldersSrc(base, folders) {
    return gulp.src(folders.map(function (item) {
        return path.join(base, item);
    }), {
        base: base,
        allowEmpty: true
    });
};