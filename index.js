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
downloadCache(sourceIndex);

//If the cache is already downloaded and the s3 stalls, comment out downloadCache
//And uncomment zipStream to resume the s3 upload without redownloading
//zipStream()


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

    output.on('close', function() {
        console.log("Zipping Complete");
        upload();
    });

    cache.forEach(function(item){
        console.log("Zipping: " + item);
        var file = cacheDir + item;
        archive.append(fs.createReadStream(file), { name: item });
    });

    console.log("Finalizing Zipping");
    archive.finalize();
}

function upload() {
    
    console.log("  Updating s3 with Package");
    
    var s3 = new AWS.S3();
    fs.readFile(cacheDir + "openaddresses.zip" , function (err, data) {
        if (err)
            throw new Error('Could not find data to upload'); 
        
        var buffer = new Buffer(data, 'binary');

        var s3 = new AWS.S3();
        
        s3.client.putObject({
            Bucket: 'openaddresses',
            Key: 'openaddresses.zip',
            Body: buffer,
            ACL: 'public-read'
        }, function (response) {
            console.log('  Successfully uploaded package.');
            updateManifest();
            process.exit(0);
        });
    });
}
