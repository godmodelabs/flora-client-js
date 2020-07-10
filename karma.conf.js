// Karma configuration
// Generated on Tue Mar 31 2015 17:38:35 GMT+0200 (CEST)

process.env.CHROME_BIN = require('puppeteer').executablePath();
// process.env.FIREFOX_BIN = require('puppeteer-firefox').executablePath();

module.exports = function karmaConfig(config) {
    'use strict';

    config.set({
        // base path that will be used to resolve all patterns (eg. files, exclude)
        basePath: '',

        // frameworks to use
        // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
        frameworks: ['mocha'], // order of plugins is important

        files: [
            'test/flora-client-browser.spec.js',
            'test/stringify.spec.js'
        ],

        // list of files to exclude
        exclude: [],

        // preprocess matching files before serving them to the browser
        // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
        preprocessors: {
            // add webpack as preprocessor
            'build/browser.js': ['webpack'],
            'test/flora-client-browser.spec.js': ['webpack'],
            'test/stringify.spec.js': ['webpack']
        },

        webpack: {
            mode: 'development'
        },

        webpackMiddleware: {
            stats: 'errors-only'
        },

        // test results reporter to use
        // possible values: 'dots', 'progress'
        // available reporters: https://npmjs.org/browse/keyword/karma-reporter
        reporters: ['progress'],

        // web server port
        port: 9876,

        // enable / disable colors in the output (reporters and logs)
        colors: true,

        // level of logging
        logLevel: config.LOG_INFO,

        // enable / disable watching file and executing tests whenever any file changes
        autoWatch: false,

        // start these browsers
        // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
        browsers: ['HeadlessChrome'/* , 'HeadlessFirefox' */],

        customLaunchers: {
            HeadlessChrome: {
                base: 'ChromeHeadless',
                flags: ['--no-sandbox']
            }/* ,
            HeadlessFirefox: {
                base: 'Firefox',
                flags: ['-headless']
            } */
        },

        // Continuous Integration mode
        // if true, Karma captures browsers, runs the tests and exits
        singleRun: true
    });
};
