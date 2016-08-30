"use strict";

var Promise         = require('bluebird')
  , _               = require('lodash')
  , urljoin         = require('url-join')
  , config          = require('config-url')
  , authorization   = require('auth-header')
  , rp              = require('request-promise')
  ;

function middleware(req, res, next) {
  Promise
    .resolve(req.get('Authorization'))
    .then((header) => {
      if (header) {
        let auth = authorization.parse(header);

        if (auth.scheme === 'Bearer' && _.size(auth.token) === 32) {
          // 1. get jwt from account server
          return rp
                  .get({ 
                      url     : urljoin(config.getUrl('account'), 'account', 'jwt')
                    , json    : true
                    , headers : {
                        'authorization' : req.get('authorization')
                      }
                  })
                  .then((result) => {
                    req.headers['authorization'] = `Bearer ${result.data}`;
                    req.user = result.__account;
                  })
        }
      }
    })
    .asCallback(next);
}

module.exports = {
  middleware  : middleware
};