/* 
* Database layer
*
* Copyright (C) Province of British Columbia, 2013
*/

var config = require('./config')

var dummyNoSql = {}

/*
* Registrar DB functions
*/
exports.validAgent = function ( token, cb ) {
  // stub for now
  process.nextTick( function () { cb( (token == 'testToken') ) } )
}

exports.getAppName = function ( appId, cb ) {
  // stub for now
  process.nextTick( function () { cb( ('Example App') ) } )
}

exports.checkAppIdAvail = function ( id, cb ) {

}

exports.newApp = function ( id, name, cb ) {

}

exports.deleteApp = function ( id, cb ) {

}

exports.refreshAppKey = function ( id, cb ) {

}


/*
* IX DB functions
*/
exports.newUser = function ( asHost, rsHosts, cb ) {

  //create entries for all AS
  // TBD: need mechanism to add new AS to system 

  // return asDI
}

exports.getRsDIfromAsDI = function ( asDI, asHost, rsHosts, cb ) {

  // return [rsDIs]
}



exports.addAgent = function ( asDI, asHost, handle, name, cb ) {

}

exports.listAgents = function ( asDI, asHost, cb ) {

}

exports.deleteAgent = function ( asDI, asHost, handle, cb ) {

}

/*
* AS DB functions
*/
exports.storeAgentRegisterSessionValue = function ( id, label, data, cb ) {
  var key = config.host.as + ':agentRegisterSession:' + id
  dummyNoSql[key] = dummyNoSql[key] || {}
  dummyNoSql[key][label] = data
  process.nextTick( function () { cb( null ) } )
}

exports.retrieveAgentRegisterSession = function ( id, cb ) {
  process.nextTick( function () {
    var key = config.host.as + ':agentRegisterSession:' + id
    cb( null, dummyNoSql[key] )
  })
}

exports.storeAgent = function ( agent, cb ) {
  var key = config.host.as + ':agent:device:' + agent.device
  dummyNoSql[key] = agent
  key = config.host.as + ':agent:handle:' + agent.handle
  dummyNoSql[key] = agent.device
  process.nextTick( function () { cb( null ) } )
}

exports.retrieveAgentFromDevice = function ( device, cb) {
  var key = config.host.as + ':agent:device:' + device
  var agent = dummyNoSql[key]
  process.nextTick( function () { cb( null, agent ) } )
}

exports.retrieveAgentFromHandle = function ( handle, cb) {
  var key = config.host.as + ':agent:handle:' + handle
  var device = dummyNoSql[key]
  var key = config.host.as + ':agent:device:' + device
  var agent = dummyNoSql[key]
  process.nextTick( function () { cb( null, agent ) } )  
}

exports.deleteAgentFromHandle = function ( handle, cb) {
  var key = config.host.as + ':agent:handle:' + handle
  var device = dummyNoSql[key]
  delete dummyNoSql[key]
  var key = config.host.as + ':agent:device:' + device
  delete dummyNoSql[key]
  process.nextTick( function () { cb( null ) } )  
}

