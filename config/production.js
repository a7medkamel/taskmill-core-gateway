var fs = require('fs');

let github = {
    ca    : fs.readFileSync('/home/nodejs/.key/ssl/www.github.run/signed/github_run.ca-bundle', 'utf-8')
  , cert  : fs.readFileSync('/home/nodejs/.key/ssl/www.github.run/signed/github_run.crt', 'utf-8')
  , key   : fs.readFileSync('/home/nodejs/.key/ssl/www.github.run/server.key', 'utf-8')
};

module.exports = {
  gateway : {
    ssl : {
        'github' : github
    }
  }
};