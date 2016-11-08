"use strict";

var urljoin = require('url-join')
  , Promise = require('bluebird')
  , url     = require('url')
  , _       = require('lodash')
  ;

function get_host_metadata(host) {
  switch(host) {
    case 'github.run':
    case 'www.github.run':
    case 'github.com':
      return {
          regex   : /^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/blob\/([A-Za-z0-9_.-]+)\/(.+)$/g
        , host    : 'github.com'
      }
    case 'gitlab.run':
    case 'www.gitlab.run':
    case 'gitlab.com':
      return {
          regex   : /^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/blob\/([A-Za-z0-9_.-]+)\/(.+)$/g
        , host    : 'gitlab.com'
      };
    case 'bitbucket.run':
    case 'www.bitbucket.run':
    case 'bitbucket.com':
      return {
          // https://bitbucket.run/a7medkamel/bitbucket-breadboard-library/src/ddcf536f37738de175aac84aae8daea265a2d83d/helloworld.js
          regex   : /^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/src\/([A-Za-z0-9_.-]+)\/(.+)$/g
        , host    : 'bitbucket.org'
      };
  }
}

function get_remote(host, username, repository) {
  switch(host) {
    case 'github.com':
      return urljoin('https://' + host, username, repository + '.git');
    case 'gitlab.com':
      return urljoin('https://' + host, username, repository + '.git');
    case 'bitbucket.org':
      // https://a7medkamel@bitbucket.org/a7medkamel/bitbucket-breadboard-library.git
      return `https://${username}@bitbucket.org/${username}/${repository}.git`;
  }
}

function parse(host, pathname) {
  let metadata = get_host_metadata(host);
  if (!metadata) {
    let parsed = url.parse('https://' + pathname.substring(1)); // trim leading /

    metadata = get_host_metadata(parsed.host);
    pathname = pathname.substring(_.size(parsed.host) + 1);
  }

  if (metadata) {
    let match = metadata.regex.exec(pathname);
    if (match) {
      return {
          remote    : get_remote(metadata.host, match[1], match[2])
        , branch    : match[3]
        , filename  : match[4]
        , uri       : 'https://' + urljoin(metadata.host, match[1], match[2] + '.git#' + match[3]) + '+' + match[4]
      };
    } else {
      throw new Error(`not a valid route: ${pathname}`);
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
          .asCallback(next);
}

module.exports = {
    parse       : parse
  , middleware  : middleware
};