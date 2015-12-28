/**
 * Created by lijungang on 8/2/15.
 */
var express = require('express');
var _ = require('lodash');
var util = require('util');
var toMongodb = require('jsonpatch-to-mongodb');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = mongoose.Types.ObjectId;
var Grid = require('gridfs-stream');
var jsonpatch = require('fast-json-patch')
var config = require('./config');
var debuglog = util.debuglog("dev");
var DomainModel = require('./domain-model');


var router = express.Router({mergeParams: true});

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
        fields = req.query.fields.split(",|\s+").join(" ");
    }

    req.docModel.find({}, fields, options, function (err, docs) {
        if (err) return next(err);
        res.json(docs);
    })
}

function create(req, res, next) {
    var doc = req.body;
    var DocModel = req.docModel;
    //var data = {};
    doc = {};
    _.each(_.range(1000), function (value) {
        doc["file" + value] = {"name": "zhangsan", "age": 24, "hobby": ["basketball", "football", "sing"]};
    });
    new DocModel(doc).save(function (err, result, numberAffected) {
        if (err) {
            next(err);
            return;
        }
        debuglog("numberAffected : %d", numberAffected);
        res.location(config.baseUrl + "/" + req.params.domainId + "/docs/" + result._id);
        res.status(201).end();
    });
}

function findById(req, res, next) {
    var docId = req.params.docId;
    req.docModel.findById(docId, function (err, doc) {
        if (err) {
            return next(err);
        }
        if (!doc) {
            res.status(404).json({message: util.format("%s does not exist", docId)});
            return;
        }
        res.json(doc);
    });
}

function replaceEntirety(req, res, next) {
    var docId = req.params.docId;
    var replaceDoc = req.body;
    req.docModel.findById(docId, function (err, doc) {
        if (err) return next(err);
        if (!doc) return res.status(404).json({message: util.format("%s does not exist", docId)});
        var options = {$inc: {__v: 1}};
        var keys = _.keys(replaceDoc);
        if (keys.length) {
            options.$set = {};
            _.each(keys, function (value) {
                options.$set[value] = replaceDoc[value];
            });
        }
        _.each(doc.toJSON(), function (value, key) {
            if (key !== "_id" && key !== "__v" && !_.includes(keys, key)) {
                options.$unset = options.$unset || {};
                options.$unset[key] = 1;
            }
        });

        debuglog("update options : %j", options);
        req.docModel.update({_id: ObjectId(docId), __v: doc.__v}, options, function (err, result) {
            if (err) return next(err);
            debuglog("docId : %s , result : %j", docId, result);
            res.status(200).end();
        })
    });

}

function deleteById(req, res, next) {
    var docId = req.params.docId;
    req.docModel.remove({_id: docId}, function (err, result) {
        if (err) return next(err);
        console.log(result);
        res.status(204).end();
    });
}

function checkPatches(patches) {
    var error = "";
    if (!_.isArray(patches)) return "patches must be array";
    _.each(patches, function (value) {
        if (value.path && !_.startsWith(value.path, "/"))  error = error + " " + value.path + " must be start with '/'";
    });
    return error;
}

function replacePart(req, res, next) {
    var docId = req.params.docId;
    var patches = req.body;
    debuglog("docId : %s , patches : %j", docId, patches);
    var error = checkPatches(patches);
    if (error) return res.status(400).json({message: error});
    var mongodbPatches = toMongodb(patches);
    debuglog("docId : %s , patches : %j", docId, mongodbPatches);
    var DocModel = req.docModel;
    DocModel.update({_id: docId}, mongodbPatches, function (err, result) {
        if (err) return next(err);
        debuglog("result : %s", result.result);
        res.status(200).end();
    })
}

function docSearch(req, res, next) {
    var options = req.body;
    var limit = options.limit || 50;
    var skip = options.offset || 0;
    var filter = options.query || {};
    var fields = options.fields || null;
    var sort = options.sort;
    var query = req.docModel.find(filter, fields, {limit: limit, skip: skip});
    if (sort) query.sort(fields);
    query.exec(function (err, docs) {
        if (err) return next(err);
        res.status(200).json(docs);
    })

}

router.use(function (req, res, next) {
    var domainId = req.params.domainId;
    util.log("query domainId : %s", domainId);
    DomainModel.findById(domainId, function (err, domain) {
        if (err) {
            next(err);
            return;
        }
        if (!domain) {
            res.status(404).json({message: util.format("%s does not exist", domainId)});
            return;
        }
        var storage = domain.storage;
        util.log("_id : %s,storage : %s", domainId, storage);
        var dbUrl = config.buildDbUrl(storage);
        var con = mongoose.createConnection(dbUrl);
        var docSchema = new Schema({}, {strict: false});
        var DocModel = con.model("DocModel", docSchema, "docs");
        con.once("open", function (err) {
            if (err) {
                util.log("connect %s error : %s", dbUrl, err);
                next(err);
                return;
            }
        });
        req.docModel = DocModel;
        var gridfs = new Grid(con.db, mongoose.mongo);
        req.gridfs = gridfs;
        util.log("connect %s success", dbUrl);
        next();
    });
});

router.route('/')
    .get(list)      //文档列表  ?limit=50&offset=0
    .post(create);  //创建文档
router.route('/:docId')
    .get(findById)        //根据文档ID查找文档
    .put(replaceEntirety) //替换文档
    .delete(deleteById)   //根据文档ID删除文档
    .patch(replacePart);  //文档局部更新
router.route('/search')
    .post(docSearch);     //文档查询

module.exports = router;


