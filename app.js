var express = require('express');
var logger = require('morgan');
var _ = require('lodash');
var bodyParser = require('body-parser');
var DomainModel = require('./domain-model');

//domain router 域路由
var domainRouter = require('./domain-router');
var docRouter = require('./doc-router');
var fileRouter = require('./file-router');

var config = require('./config');
var port = config.serverPort || 3000;

var app = express();

app.use(logger('dev'));
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}))

// parse application/json
app.use(bodyParser.json({type: ['json', '+json']}));
app.set("json spaces", 4)
//var replacer = app.get('json replacer');
//var spaces = app.get('json spaces');

app.get("/api/v1", function (req, res, next) {
    res.send("文件管理系统v1");
});


app.use('/api/v1/metadata', domainRouter);//域路由
app.use('/api/v1/:domainId/docs', docRouter);//文档实例路由
app.use('/api/v1/:domainId/files', fileRouter);//文件路由

app.use(function (err, req, res, next) {
    var clientErrorTypes = ["SyntaxError"];
    var ServerErrorTypes = ["MongoError"];
    console.error(err.name);
    console.error(err.stack);
    var message = err.message || "unknown_error";
    var errCode = err.errCode || 999;
    res.status(500).json({errCode: errCode, message: message});
});

var server = app.listen(port, function () {
    console.log('Listening on port %d', server.address().port);
});
