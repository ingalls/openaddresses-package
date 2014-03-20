#!/usr/bin/env node

//NPM Dependancies
var argv = require('minimist')(process.argv.slice(2)),
    fs = require('fs'),
    ProgressBar = require('progress'),
    crypto = require('crypto'),
    AWS = require('aws-sdk'),
    archiver = require('archiver'),
    request = require('request');

//Command Line Args
var sourceDir = argv._[0],
    cacheDir = argv._[1];

var sourceIndex = 0,
    cacheIndex = 0;

//Check Arguments
if (!sourceDir || !cacheDir) {
    throw new Error('usage: openaddresses-package <path-to-sources> <working-directory>');
}

//Setup list of sources
var sources = fs.readdirSync(sourceDir);

//Only retain *.json
for (var i = 0; i < sources.length; i++) {
    if (sources[i].indexOf('.json') == -1) {
        sources.splice(i, 1);
        i--;
    }
}

//Begin Downloading Sources
//downloadCache(sourceIndex);
zipStream();

function downloadCache(index) {
    if (index >= sources.length) {
        console.log("Complete!");
        process.exit();
    }

    var source = sources[index];
    
    parsed = JSON.parse(fs.readFileSync(sourceDir + source, 'utf8'));

    if (!parsed.cache || parsed.skip === true){
        console.log("Skipping: " + source);
        downloadCache(++sourceIndex);
    } else {
        console.log("Downloading: " + source);


        var stream = request(parsed.cache)
        
        showProgress(stream);
        stream.pipe(fs.createWriteStream(cacheDir + source.replace(".json", ".zip")));
    }
}

function zipStream() {
    console.log("Zipping Packages");
    var cache = fs.readdirSync(cacheDir);
    var output = fs.createWriteStream(cacheDir + "openaddresses.zip"),
    
    archive = archiver('zip');
    archive.pipe(output);

    cache.forEach(function(item){
        console.log("Zipping: " + item);
        var file = cacheDir + item;
        archive.append(fs.createReadStream(file), { name: item });
    });

    archive.finalize(function(err, written) {
        if (err) throw err;
    });

    output.on('close', function() {
      upload();
    });
}

function upload() {
    console.log("Complete");
}
