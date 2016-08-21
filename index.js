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
  , http          = require('http')
  , https         = require('https')
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
  Promise
    .try(() => {
      return parser.parse(req.hostname, req.path);
    })
    .then((route) => {
      if (!route) {
        return res.end();
      }

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

        // todo [akamel] for some reason we need to disable .end for https to work...
        // res.end = () => {
        //   // console.trace('end');
        // }
 
        relay.emit(data, req, res);
      });
    })
    .catch((err) => {
      winston.error(err);
      res.end();
    })
});

function main() {
  relay
    .listen()
    .then((info) => {
      winston.info('taskmill-core-gateway [relay] :http://localhost:%d', '0');
    });

  // app.listen(config.get('www.port'), function() {
  //   let port = this.address().port;
  //   winston.info('taskmill-core-gateway [started] :http://localhost:%d', port);
  // });

  if (config.has('gateway.ssl.github.cert')) {
    let https_server = https.createServer({
                          key   : config.get('gateway.ssl.github.key')
                        , cert  : config.get('gateway.ssl.github.cert')
                        , ca    : config.has('gateway.ssl.github.ca')? config.get('gateway.ssl.github.ca') : undefined
                      }, app);

    https_server.listen(config.get('gateway.port'), function() {
      let port = this.address().port;
      winston.info('taskmill-core-gateway [started] :https://localhost:%d', port);
    });

    let http_server = http.createServer((req, res) => {
      res.end();
    });

    http_server.listen(config.get('gateway.port') + 1, function() {
      let port = this.address().port;
      winston.info('taskmill-core-gateway [started] :http://localhost:%d', port);
    });
  } else {
    let http_server = http.createServer(app);

    http_server.listen(config.get('gateway.port') + 1, function() {
      let port = this.address().port;
      winston.info('taskmill-core-gateway [started] :http://localhost:%d', port);
    });
  }
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