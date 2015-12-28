/**
 * Created by lijungang on 8/1/15.
 */
var express = require('express');
var _ = require('lodash');
var util = require('util');
var config = require('./config');
var DomainModel = require('./domain-model');
var debuglog = util.debuglog('dev');
var router = express.Router({mergeParams: true});

//域EndPoint
function list(req, res, next) {//获取所有的域
    console.log(DomainModel.find);
    DomainModel.find({}, function (err, docs) {
        if (err) return next(err);
        res.json(docs);
    });
}

function create(req, res, next) {//新建域
    var domain = _.pick(req.body, ["_id", "description", "display", "storage"]);
    domain.createdAt = new Date();
    domain.modifiedAt = new Date();
    new DomainModel(domain).save(function (err, doc, numberAffected) {
        if (err) return next(err);
        debuglog("numberAffected : %d", numberAffected);
        res.location(config.baseUrl + "/metadata/" + doc._id);
        res.status(201).end();
    })
}

function findById(req, res, next) {//根据域id获取域
    var domainId = req.params.domainId;
    DomainModel.findById(domainId, function (err, doc) {
        if (err) return next(err);
        if (!doc) return res.status(404).json({message: util.format("%s does not exist", domainId)});
        res.json(doc);
    });
}

function deleteById(req, res, next) {//根据域id删除域
    var domainId = req.params.domainId;
    DomainModel.remove({_id: domainId}, function (err, result) {
        if (err) return next(err);
        debuglog("id : %s , result : %j", domainId, result.result);
        res.status(204).end();
    });
}

function replaceEntirety(req, res, next) {//修改域
    var domainId = req.params.domainId;
    var updateDomain = _.pick(req.body, ["description", "display", "storage"]);
    DomainModel.update({_id: domainId}, updateDomain, function (err, result) {
        if (err) return next(err);
        debuglog("id : %s , result : %j", domainId, result);
        res.status(200).end();
    })
}

router.route('/').get(list).post(create);
router.route('/:domainId').get(findById).put(replaceEntirety).delete(deleteById);
module.exports = router;
