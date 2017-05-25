"use strict";

var Promise               = require('bluebird')
  , _                     = require('lodash')
  , config                = require('config-url')
  , AgentRegistry         = require('./AgentRegistry')
  ;

class Relay {
  constructor() {
    this.agent_registry = new AgentRegistry();
  }

  stats() {
    return this.agent_registry.stats();
  }

  registry() {
    return this.agent_registry;
  }

  // emit(task, req, res) {
  //   // start task; but don't wait for it to return in emit call...
  //   return task
  //           .try_cache()
  //           .then((result) => {
  //             // todo [akamel] race condition cache can delete while we are reading
  //             // todo [akamel] change cache-control here to account for time since caching...
  //             res.set(result.metadata.headers);
  //             result.stream.pipe(res);
  //           })
  //           // try running if not cached
  //           .catch((err) => {
  //             return Promise
  //                     .try(() => {
  //                       return this.agent_registry.findRunOn(task);
  //                     })
  //                     .then((agent) => {
  //                       if (!agent) {
  //                         throw new Error('no agents available');
  //                       }

  //                       return task.runOn(agent);
  //                     });
  //           })
  //           .return(task)
  //           .catch((err) => {
  //             task.decline(err);

  //             throw err;
  //           });
  // }
}

module.exports = Relay;
