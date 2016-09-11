var config    = require('config-url')
  , winston   = require('winston')
  , http      = require('./lib')
  ;

process.on('uncaughtException', function (err) {
  console.error(err.stack || err.toString());
});

// NOTE: event name is camelCase as per node convention
// process.on("unhandledRejection", function(reason, promise) {
//     // See Promise.onPossiblyUnhandledRejection for parameter documentation
//     console.log(reason, promise);
// });

function main() {
  return http
          .listen({ port : config.getUrlObject('gateway').port })
          .then(() => {
            winston.info('taskmill-gateway-api [started] :%d', config.getUrlObject('gateway').port);
          });
}

if (require.main === module) {
  main();
}

module.exports = {
  main  : main
};