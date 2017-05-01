"use strict";

var Promise         = require('bluebird')
  , metering        = require('taskmill-api-metering')
  , config          = require('config')
  , ua              = require('universal-analytics')
  , uuid_parse      = require('uuid-parse')
  ;

let ua_id = config.get('universal-analytics.id');

function middleware(req, res, next) {
  return Promise
          .try(() => {
            var uid     = req.user? req.user.id : undefined
              , uid_v4  = uid? uuid_parse.unparse(uuid_parse.parse(uid)) : '00000000-0000-0000-0000-000000000000'
              ;

            req.visitor = ua(ua_id, uid_v4, { strictCidFormat: false });//.debug();
                
            req
              .visitor
              .pageview(req.url, '', req.hostname)
              .send();
          })
          .asCallback(next);
}

module.exports = {
    middleware  : middleware
};