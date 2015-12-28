/**
 * Created by lijungang on 8/2/15.
 */
var express = require('express');
var _ = require('lodash');
var Q = require('q');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var Grid = require('gridfs-stream');
var util = require("util");
var multer = require('multer');
var config = require("./config");
var DomainModel = require('./domain-model');
///api/v1/:domainId
var router = express.Router({mergeParams: true});
var storage = multer.memoryStorage();
var upload = multer({storage: storage}).single("file");


function list(req, res, next) {
    var options = {limit: 50, skip: 0};
    var fields = null;
    var reg = /^\d+$/;
    if (req.query.limit && reg.test(req.query.limit)) {
        options.limit = parseInt(req.query.limit);
    }
    if (req.query.offset && reg.test(req.query.offset)) {
        options.skip = parseInt(req.query.offset);
    }
    if (req.query.fields) {
        options.fields = options.fields || {};
        fields = req.query.fields.split(",|\s+");
        _.reduce(fields, function (initValue, value) {
            initValue[value] = 1;
            return initValue;
        }, options.fields);
    }

    var gridfs = req.gridfs;
    var queryCursor = gridfs.files.find({}, options);
    if (req.query.sort) {
        var temp = req.query.sort.split(",");
        var sort = _.reduce(temp, function (initValue, value) {
            if (_.startsWith(value, "-")) initValue[value.trim().replace("-", "")] = -1;
            else initValue[value.trim().replace("+", "")] = 1;
            return initValue;
        }, {});
        console.log(sort);
        queryCursor.sort(sort);
    }
    queryCursor.toArray(function (err, docs) {
        if (err) return next(err);
        res.json(docs);
    });
}

function create(req, res, next) {
    upload(req, res, function (err) {
        if (err) {
            next(err);
            return;
        }
        var options = {filename: req.file.originalname, content_type: req.file.mimetype};
        if (req.body.filename) {
            options.filename = req.body.filename;
        }
        if (req.body.content_type) {
            options.content_type = req.body.content_type;
        }
        if (req.body.chunkSize) {
            options.chunkSize = req.body.chunkSize;
        }
        console.log(options);
        var gridfs = req.gridfs;
        var writeStream = gridfs.createWriteStream(options);
        writeStream.write(req.file.buffer);
        writeStream.end();
        writeStream.on('close', function (file) {
            res.location("api/v1/%s/files/%s", req.domainId, file._id);
            res.status(201).end();
        });
    });
}

function findById(req, res, next) {
    var fileId = req.params.fileId;
    var gridfs = req.gridfs;
    gridfs.findOne({_id: fileId}, function (err, file) {
        if (err) return next(err);
        if (!file) return next(new Error("file does not exist"));
        res.json(file);
    });
}

function deleteById(req, res, next) {
    var fileId = req.params.fileId;
    var gridfs = req.gridfs;
    gridfs.remove({_id: fileId}, function (err, result) {
        if (err) return next(err);
        res.status(204).end();
    });
}

function content(req, res, next) {
    var fileId = req.params.fileId;
    var gridfs = req.gridfs;
    gridfs.exist({_id: fileId}, function (err, found) {
        if (err) return next(err);
        if (!found) return next(new Error("file does not exist"));
        var readStream = gridfs.createReadStream({_id: fileId});
        readStream.pipe(res);
    });
}

function replaceContent(req, res, next) {
    var fileId = req.params.fileId;
    upload(req, res, function (err) {
        if (err) return next(err)
        var gridfs = req.gridfs;
        gridfs.remove({_id: fileId}, function (err) {
            if (err) return next(err);
            var writeStream = gridfs.createWriteStream({_id: fileId});
            writeStream.write(req.file.buffer);
            writeStream.end();
            res.status(200).end();
        })

    });
}

function download(req, res, next) {
    var fileId = req.params.fileId;
    var gridfs = req.gridfs;
    gridfs.exist({_id: fileId}, function (err, found) {
        if (err) return next(err);
        if (!found) return next(new Error("file does not exist"));
        res.set({
            'Content-Disposition': "attachment;filename=" + encodeURIComponent(result.filename) + ";filename*=utf-8''" + encodeURIComponent(result.filename)
        });
        gridfs.createReadStream({_id: fileId}).pipe(res);
    });
}

function search(req, res, next) {
    var query = req.body.query || {};
    var options = {};
    options.limit = req.body.limit || 50;
    options.skip = req.body.offset || 0;
    if (req.body.fields) options.fields = req.body.fields;
    var gfs = req.gridfs;
    var queryCursor = gfs.files.find(query, options);
    if (req.body.sort) {
        queryCursor.sort(req.body.sort);
    }
    queryCursor.toArray(function (err, files) {
        if (err) return next(err);
        res.json(files);
    });
}


router.use(function (req, res, next) {
    var domainId = req.params.domainId;
    DomainModel.findById(domainId, function (err, result) {
        if (err) return next(err);
        if (!result) return next(new Error("domainId does not exist"));
        var dbUrl = config.dbUrlTemplate.replace("{database}", result.storage);
        var con = mongoose.createConnection(dbUrl);
        con.once("open", function (err) {
            if (err) return next(err);
            util.log("connect %s success", dbUrl);
            var gridfs = new Grid(con.db, mongoose.mongo);
            req.gridfs = gridfs;
            next();
        });
    });
});

router.route('/')
    .get(list)
    .post(create);
router.route('/:fileId')
    .get(findById)
    .delete(deleteById)
router.route('/:fileId/content')
    .get(content);
router.get('/:fileId/download', download);
router.post('/search', search);
module.exports = router;