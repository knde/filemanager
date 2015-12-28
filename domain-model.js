/**
 * Created by lijungang on 8/1/15.
 */
var Q = require('q');
var _ = require('lodash');
var util = require('util');
var config = require('./config');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var db = mongoose.createConnection(config.metadataDbUrl);
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function (err) {
    if (err) console.err(err);
    else console.log(util.format("%s : connect success", config.metadataDbUrl));
})


var DomainSchema = new Schema({
    _id: String,
    "storage": {type: String},
    "display": {type: String},
    "description": {type: String},
    "createdAt": {type: Date},
    "modifiedAt": {type: Date},
    "__v": {type: Number, select: false}
});
var DomainModel = db.model("DomainModel", DomainSchema, "domains");
module.exports = exports = DomainModel;