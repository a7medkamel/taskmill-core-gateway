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

        if (auth.scheme === 'Bearer') {
         let re   = /Bearer\s([0-9a-fA-F]{24}):([0-9a-zA-Z+\/=]{12})\.([0-9a-zA-Z+\/=]{32})/
          , match = re.exec(header)
          ;

          if (match) {
            let sub     = match[1]
              , prefix  = match[2]
              , secret  = match[3]
              ;

            // 1. get jwt from account server
            // /account/:id/secret/:secret/token
            return rp
                    .get({ 
                        url     : urljoin(config.getUrl('account'), 'account', sub, 'secret', `${prefix}.${secret}`, 'token')
                      , json    : true
                      , headers : {
                          'authorization' : req.get('authorization')
                        }
                    })
                    .then((result) => {
                      req.bearer = `Bearer ${result.data}`;
                      req.headers['authorization'] = req.bearer;
                      req.user = result.__account;
                    })
          }
        }
      }
    })
    .asCallback(next);
}

module.exports = {
  middleware  : middleware
};