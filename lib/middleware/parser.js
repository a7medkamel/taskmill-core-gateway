"use strict";

var Promise = require('bluebird')
  , git     = require('taskmill-core-git')
  ;

function middleware(req, res, next) {
  return Promise
          .try(() => {
            req.route = git.parse(req.hostname, req.path);
          })
          .asCallback(next);
}

module.exports = {
  middleware  : middleware
};