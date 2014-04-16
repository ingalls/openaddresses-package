#!/usr/bin/env node

//NPM Dependancies
var argv = require('minimist')(process.argv.slice(2)),
    fs = require('fs');

//Command Line Args
var type = argv._[0],
    sourceDir = argv._[1],
    cacheDir = argv._[2];

//Check Arguments
if (!type || !sourceDir || !cacheDir) {
    throw new Error('usage: openaddresses-package <raw|conform> <path-to-sources> <working-directory>');
}

if (cacheDir.substr(cacheDir.length-1) != "/")
    cacheDir = cacheDir + "/";

if (sourceDir.substr(sourceDir.length-1) != "/")
    sourceDir = sourceDir + "/";

//Setup list of sources
var sources = fs.readdirSync(sourceDir);

//Only retain *.json
for (var i = 0; i < sources.length; i++) {
    if (sources[i].indexOf('.json') == -1) {
        sources.splice(i, 1);
        i--;
    }
}

if (type == "raw") {
    package = require('./package-raw');
    package.start(sourceDir, cacheDir, sources);
} else if (type == "conform") {
    package = require('./package-pro');
    package.start(sourceDir, cacheDir, sources);
} else
    console.log("Type must be 'raw' or 'conform'");
