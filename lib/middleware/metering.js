"use strict";

var Promise         = require('bluebird')
  , metering        = require('taskmill-api-metering')
  ;

function middleware(req, res, next) {
  return Promise
          .try(() => {
            return metering.can('run', req.user);
          })
          .then(() => next()) // mask return
          .catch((err) => {
            res.status(403).send({
              message : err.message
            });
          });
}

module.exports = {
    middleware  : middleware
  , did         : metering.did
};