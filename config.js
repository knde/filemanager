/**
 * Created by lijungang on 7/31/15.
 */
var _ = require('lodash');

exports.serverPort = 3000;
exports.baseUrl = "/api/v1";

exports.metadataDbUrl = "mongodb://192.168.3.159:27017/metadata";
var dbUrlTemplate = "mongodb://192.168.3.159:27017/<%= database %>";
var compiled = _.template(dbUrlTemplate);

exports.buildDbUrl = function (database) {
    return compiled({database: database});
}

