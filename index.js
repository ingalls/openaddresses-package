#!/usr/bin/env node

//NPM Dependancies
var argv = require('minimist')(process.argv.slice(2)),
    fs = require('fs'),
    ProgressBar = require('progress'),
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
//zipStream();
//uploadPackage();

//TODO
//clean();

function downloadCache(index) {
    if (index >= sources.length) {
        console.log("Complete!");
        zipStream();
    } else {

        var source = sources[index];
        
        parsed = JSON.parse(fs.readFileSync(sourceDir + source, 'utf8'));

        if (!parsed.cache || parsed.skip === true){
            console.log("Skipping: " + source);
            downloadCache(++sourceIndex);
        } else {
            console.log("Downloading: " + source);

            var stream = request(parsed.cache);
            
            showProgress(stream);
            stream.pipe(fs.createWriteStream(cacheDir + source.replace(".json", ".zip")));
        }
    }

    function showProgress(stream) {
        var bar;
        
        stream.on('response', function(res) {
            var len = parseInt(res.headers['content-length'], 10);
            bar = new ProgressBar('  downloading [:bar] :percent :etas', {
                complete: '=',
                incomplete: '-',
                width: 20,
                total: len
            });
        });
        stream.on('data', function(chunk) {
            if (bar) bar.tick(chunk.length);
        }).on('end', function() {
            downloadCache(++cacheIndex);
        });
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
        uploadPackage();
    });

    cache.forEach(function(item) {
        console.log("Zipping Zips: " + item);
        var file = cacheDir + item;
        archive.append(fs.createReadStream(file), { name: item });
    });

    sources.forEach(function(manifest) {
        console.log("Zipping Manifest: " + manifest);
        var file = sourceDir + manifest;
        archive.append(fs.createReadStream(file), { name: manifest });
    });

    console.log("Finalizing Zipping");
    archive.finalize();
}

function uploadPackage() {
    console.log("Uploading to s3");
    var Uploader = require('s3-streaming-upload').Uploader,
        upload = null,
        stream = fs.createReadStream(cacheDir + "openaddresses.zip");

    upload = new Uploader({
        accessKey:  process.env.AWS_ACCESS_KEY_ID,
        secretKey:  process.env.AWS_SECRET_ACCESS_KEY,
        bucket:     "openaddresses",
        objectName: "openaddresses.zip",
        stream:     stream,
        objectParams: {
            ACL: 'public-read'
        }
    });

    upload.on('completed', function (err, res) {
        console.log('upload completed');
    });

    upload.on('failed', function (err) {
        console.log('upload failed with error', err);
    });
}

function clean() {
    console.log("Removing Orphaned S3 Packages");

    var s3 = new AWS.S3();
    var params = {
        Bucket: "openaddresses"
    }

    s3.listObjects(params, function(err, data) {
        for (var i = 0; i < data.Contents.length; i++) {
            if (!checkSource(data.Contents[i].Key)) {
                console.log("  Removing Orphaned package");
                process.exit(0);
            }
        }  
    });
}

function checkSource(s3Key) {
    var found = false;
    
    for (var e = 0; e < sources.length; e++) {
        parsed = JSON.parse(fs.readFileSync(sourceDir + source, 'utf8'));
        local = parsed.cache.replace("http://s3.amazonaws.com/openaddresses/","");

        if (s3Key == local)
            found = true;
    }    
    return found;
}

