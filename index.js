"use strict";

var Promise       = require('bluebird')
  , express       = require('express')
  , winston       = require('winston')
  , _             = require('lodash')
  , cors          = require('cors')
  , config        = require('config-url')
  , Relay         = require('taskmill-core-relay').Relay
  , parser        = require('./lib/parser')
  , ua            = require('universal-analytics')
  ;

var app = express();

var relay = new Relay();

app.use((req, res, next) => {
  req.visitor = ua(config.get('universal-analytics.id'));//.debug();

  req
    .visitor
    .pageview(req.url, '', req.hostname)
    .send();

  next();
});

app.get('/', (req, res) => {
  res.end();
  // todo [akamel] redirect to breadboard.io
});

app.all('/*', (req, res, next) => {
  // todo [akamel] this doesn't take port nto account
  var route = parser.parse(req.hostname, req.path);
  if (route) {
    cors({
        exposedHeaders : ['x-request-id']
    })(req, res, () => {
      if (req.method === 'OPTIONS') {
        res.end();
        return;
      }

      req.visitor.event('Gateway', 'Run', req.hostname, req.url, { p : req.url }).send();

      var data = {
        codedb_url  : config.getUrl('codedb')
      };

      var blob = req.get('blob');
      if (blob) {
        data.blob = new Buffer(blob, 'base64').toString('utf8');
      }

      var ttl_id = req.get('tty.id');
      if (ttl_id) {
        data.tty = {
            ws : config.getUrl('tty')
          , id : ttl_id
        }
      }

      _.extend(data, route);

      relay.emit(data, req, res);
    });
    
  } else {
    res.end();
  }
});

function main() {
  relay
    .listen()
    .then((info) => {
      winston.info('taskmill-core-gateway [relay] :http://localhost:%d', '0');
    });

  app.listen(config.get('www.port'), function() {
    let port = this.address().port;
    winston.info('taskmill-core-gateway [started] :http://localhost:%d', port);
  });
}

main();

// todo [akamel] expose active agents and stats
// index: function (req, res, next) {
//   var agents = _.map(Relay.get().agent_registry.find(), function(value){
//     var ret = value.info || { error : 'no info reported' };

//     if (ret.workers) {
//       ret.workers = _.map(ret.workers, function(w){
//         // todo [akamel] do we still have this info being sent?
//         return _.omit(w, 'protocol', 'hostname', 'dir');
//       });
//     }

//     return ret;
//   });

//   res.render('admin/index', {
//       model         : agents
//     , user          : req.user
//   });
// }