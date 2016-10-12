"use strict";

var urljoin = require('url-join')
  , Promise = require('bluebird')
  ;

function parse(host, url) {
  let regex     = undefined
    , git_host  = undefined
    ;

  switch(host) {
    case 'github.run':
    case 'www.github.run':
    case 'localhost':
    regex = /^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/blob\/([A-Za-z0-9_.-]+)\/(.+)$/g;
    git_host = 'github.com'
    break;
    case 'gitlab.run':
    case 'www.gitlab.run':
    regex = /^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/blob\/([A-Za-z0-9_.-]+)\/(.+)$/g;
    git_host = 'gitlab.com'
    break;
    break;
    case 'bitbucket.run':
    case 'www.bitbucket.run':
    regex = /^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/src\/([A-Za-z0-9_.-]+)\/(.+)$/g;
    git_host = 'bitbucket.com'
    break;
  }

  if (regex) {
    let match = regex.exec(url);
    if (match) {
      return {
          remote    : urljoin('https://' + git_host, match[1], match[2] + '.git')
        , branch    : match[3]
        , filename  : match[4]
        , uri       : 'https://' + urljoin(git_host, match[1], match[2] + '.git#' + match[3]) + '+' + match[4]
      };
    }
  } else {
    throw new Error('unknown host');
  }
}

function middleware(req, res, next) {
  return Promise
          .try(() => {

            req.route = parse(req.hostname, req.path);            
            // req.profiler.done('route.parse');
          })
          .asCallback((err, result) => {
            if (!err) {
              if (!req.route) {
                err = new Error(`not a valid route: ${req.url}`);
              }
            }

            next(err);
          });
}

module.exports = {
    parse       : parse
  , middleware  : middleware
};