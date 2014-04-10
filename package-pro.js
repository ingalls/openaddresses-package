var sourceDir,
    cacheDir,
    sources;

exports.start = function start(sourceDirIn, cacheDirIn, sourcesIn) {
    sourceDir = sourceDirIn;
    cacheDir = cacheDirIn;
    sources = sourcesIn;
    downloadCache(sourceIndex);
}

var request = require('request'),
    archiver = require('archiver'),
    ProgressBar = require('progress'),
    fs = require('fs');

var sourceIndex = 0,
    cacheIndex = 0;

function downloadCache(index) {
    if (index >= sources.length) {
        console.log("Complete!");
        zipStream();
    } else {

        try {
            var source = sources[index];

            parsed = JSON.parse(fs.readFileSync(sourceDir + source, 'utf8'));

            if (!parsed.processed || parsed.skip === true){
                console.log("Skipping: " + source);
                downloadCache(++sourceIndex);
            } else {
                console.log("Downloading: " + source);

                var stream = request(parsed.processed);
                
                showProgress(stream);
                stream.pipe(fs.createWriteStream(cacheDir + source.replace(".json", ".csv")));
            }
        } catch (err) {
            console.log("Error accessing" + source);
            downloadCache(++sourceIndex)
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
    var output = fs.createWriteStream(cacheDir + "openaddresses-conform.zip"),
        archive = archiver('zip');

    archive.pipe(output);

    output.on('close', function() {
        console.log("Zipping Complete");
        uploadPackage();
    });

    cache.forEach(function(item) {
        console.log("Zipping Files: " + item);
        var file = cacheDir + item;
        archive.append(fs.createReadStream(file), { name: item });
    });

    //sources.forEach(function(manifest) {
    //    console.log("Zipping Manifest: " + manifest);
    //    var file = sourceDir + manifest;
    //    archive.append(fs.createReadStream(file), { name: manifest });
    //});

    console.log("Finalizing Zipping");
    archive.finalize();
}

function uploadPackage() {
    console.log("Uploading to s3");
    var Uploader = require('s3-streaming-upload').Uploader,
        upload = null,
        stream = fs.createReadStream(cacheDir + "openaddresses-conform.zip");

    upload = new Uploader({
        accessKey:  process.env.AWS_ACCESS_KEY_ID,
        secretKey:  process.env.AWS_SECRET_ACCESS_KEY,
        bucket:     "openaddresses",
        objectName: "openaddresses-processed.zip",
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

