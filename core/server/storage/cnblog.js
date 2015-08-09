/**
 * Created by liang on 2015/8/6.
 */
var _ = require("lodash"),
    hbs = require("express-hbs"),
    moment = require("moment"),
    Promise = require("bluebird"),
    request = Promise.promisify(require("request")),
    parseString = require("xml2js").parseString,
    fs = Promise.promisifyAll(require("fs")),
    cronJob = require("cron").CronJob,
    filePath = __dirname + "/cnblog.json";

var errTime = 0;

var cnblog = (function(){
    var json;
    return {
        get:function(){
            if(!json){
                updateCnblog(errorHandler);

                return fs.readFileAsync(filePath,"utf8")
                    .then(JSON.parse);
            }
            return Promise.resolve(json);
        },
        set:function(j){
            json = j;
        }
    }
})();

function updateCnblog (errorHandler){
    return request("http://www.cnblogs.com/zhiyishou/rss")
        .spread(function(res,body){
            if(res.statusCode == 200){
                return Promise.promisify(parseString)(body);
            }else{
                return Promise.reject("Http request fail!");
            }
        })
        .then(function(result){
            var tempPublished,
                tempObject,
                newEntry = [];

            _.map(result.feed.entry,function(entry){
                var object = {
                    title: entry.title[0]["_"].match(/.*(?=\s-)/)[0],
                    url: hbs.handlebars.Utils.escapeExpression(entry.link[0]["$"].href)
                };

                tempObject = _.last(newEntry);
                tempPublished = moment(new Date(entry.published)).format("MMM YYYY");
                if(tempObject && tempObject.published == tempPublished){
                    tempObject.entries.push(object);
                }else{
                    newEntry.push({
                        published: tempPublished,
                        entries: [object]
                    });
                }
            });

            return newEntry;
        })
        .then(function(result) {
            cnblog.set(result);
            return fs.writeFileAsync(filePath, JSON.stringify(result), "utf8");
        })
        .catch(errorHandler);
}

function errorHandler(){
    console.log(e);
    if(errTime++ < 3) {
        console.log("Will refetch again!");
        setTimeout(doJob, 10000);
    }
}

function doJob(){
    updateCnblog(errorHandler);
}


function cronUpdate(){
    new cronJob("0 0 0 * * *",function(){
        errTime = 0;
        doJob();
    },null,true,"Asia/Shanghai");
}

function init(){
    doJob();
    cronUpdate();
}

exports.getCnblog = cnblog.get;
exports.init = init;
