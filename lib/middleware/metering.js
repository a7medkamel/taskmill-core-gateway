"use strict";

var Promise         = require('bluebird')
  , metering        = require('taskmill-api-metering')
  ;

function middleware(req, res, next) {
  return Promise
          .try(() => {
            return metering.can('run', req.user);
          })
          .asCallback((err) => {
            if (err) {
              return res.status(403).send({ message : err.message });
            }
            
            next(err);
          })
}

module.exports = {
    middleware  : middleware
  , did         : metering.did
};