"use strict";

var Promise         = require('bluebird')
  , metering        = require('taskmill-api-metering')
  ;

function middleware(req, res, next) {
  return metering
          .can('run', req.user)
          .asCallback((err, ret) => {
            if (err) {
              return res.status(403).send({ message : err.message });
            }

            next(undefined, ret);
          });
}

module.exports = {
    middleware  : middleware
  , did         : metering.did
};
