"use strict";

var urljoin = require('url-join');

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

module.exports = {
    parse : parse
};