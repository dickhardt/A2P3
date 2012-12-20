/* 
* Database layer
*
* Copyright (C) Province of British Columbia, 2013
*/

var config = require('./config')
  , di = require('./di')

var dummyNoSql = {}

var keys = {}
keys[config.host.registrar] = {}

function makeKey () {
  var result = {}
    , bytesKey = 64 // TBD put this code into same place as vault/build ??
    , bytesKid = 12

  result.key = b64url.safe( crypto.randomBytes( bytesKey ).toString('base64') )
  result.kid = b64url.safe( crypto.randomBytes( bytesKid ).toString('base64') )
  return result
}


/*
* Registrar DB functions
*/
exports.validAgent = function ( handle, cb ) {
  var valid = dummyNoSql[config.host.registrar + ':agentHandle:' + handle]
  process.nextTick( function () { cb( ( valid ) ) } )
}

exports.getAppName = function ( id, cb ) {
  var name = dummyNoSql[config.host.registrar + ':app:' + id + ':name']
  process.nextTick( function () { cb( ('Example App') ) } )
}

exports.checkRegistrarAppIdTaken = function ( id, cb ) {
  var taken = dummyNoSql.hasOwnProperty( config.host.registrar + ':app:' + id + ':name' )
  process.nextTick( function () { cb( ( null, taken ) ) } )
}

exports.newRegistrarApp = function ( id, name, admin, cb ) {
  // add to DB
  dummyNoSql[config.host.registrar + ':app:' + id + ':name'] = name
  dummyNoSql[config.host.registrar + ':app:' + id + ':admins'] = {}
  dummyNoSql[config.host.registrar + ':app:' + id + ':admins'][admin] = 'ACTIVE'
  dummyNoSql[config.host.registrar + ':admin:' + admin + ':apps'] = {}
  dummyNoSql[config.host.registrar + ':admin:' + admin + ':apps'][id] = 'ACTIVE'
  // add keys to DB Vault
  var newKey = makeKey()
  var o = {latest: newKey}
  o[newKey.kid] = newKey.key
  keys[config.host.registrar][id] = o

  process.nextTick( function () { cb( ( null, newKey ) ) } )
}

exports.addRegistrarAppAdmin = function ( id, admin, cb ) {
  dummyNoSql[config.host.registrar + ':app:' + id + ':admins'][admin] = 'ACTIVE'
  dummyNoSql[config.host.registrar + ':admin:' + admin + ':apps'][id] = 'ACTIVE'
  process.nextTick( function () { cb( ( null ) ) } )
}

exports.deleteRegistrarAppAdmin = function ( id, admin, cb ) {
  delete dummyNoSql[config.host.registrar + ':app:' + id + ':admins'][admin]
  delete dummyNoSql[config.host.registrar + ':admin:' + admin + ':apps'][id]
  process.nextTick( function () { cb( ( null ) ) } )
}

exports.deleteRegistrarApp = function ( id, cb ) {
  delete dummyNoSql[config.host.registrar + ':app:' + id + ':name']
  delete keys[config.host.registrar][id]
  var admins = Object( dummyNoSql[config.host.registrar + ':app:' + id + ':admins'] ).keys()
  admins.forEach( function (admin) {
    delete dummyNoSql[config.host.registrar + ':admin:' + admin + ':apps'][id]
  })
  process.nextTick( function () { cb( ( null ) ) } )
}

exports.refreshRegistrarAppKey = function ( id, cb ) {
  var newKey = makeKey()
  var o = {latest: newKey}
  o[newKey.kid] = newKey.key
  keys[config.host.registrar][id] = o

  process.nextTick( function () { cb( ( null, newKey ) ) } )
}

exports.getRegistrarAppKey = function ( id, cb ) {
  var key = keys[config.host.registrar][id]
  process.nextTick( function () { cb( ( null, key ) ) } )
}

/*
* IX DB functions
*/
// creats a new User directed identifier and stores pointers from all AS
exports.newUser = function ( asHost, rsHosts, cb ) {

  // create identifiers
  var ixDI = di.create()
  var dis = {}
  rsHosts.forEach( function ( host ) {
    dis[host] = di.map( host, ixDI )
  })

  // store DI pointers
  dummyNoSql[config.host.ix + ':di:' + ixDI] = {}
  Object.keys( config.roles.as ).forEach( function (asHost) {
    var asDI = di.map( asHost, ixDI )
    dummyNoSql[config.host.ix + ':di:' + asHost + ':' + asDI] = ixDI
  })

  process.nextTick( function () { cb( null, dis ) } )
}

// gets DIs for each RS from AS DI
exports.getRsDIfromAsDI = function ( asDI, asHost, rsHosts, cb ) {
  var ixDI = dummyNoSql[config.host.ix + ':di:' + asHost + ':' + asDI]
  var rsDI = {}
  rsHosts.forEach( function (rsHost) {
    rsDI[rsHost] = diMap( rsHost, ixDI )
  })

  process.nextTick( function () { cb( null, rsDI ) } )
}


// functions to add, list and delete agents from DB
exports.addAgent = function ( asDI, asHost, handle, name, cb ) {
  var ixDI = dummyNoSql[config.host.ix + ':di:' + asHost + ':' + asDI]
  dummyNoSql[config.host.ix + ':di:' + ixDI][handle] = name
  dummyNoSql[config.host.ix + ':di:' + ixDI + ':handle:' + handle] = asHost

  dummyNoSql[config.host.registrar + ':agentHandle:' + handle] = true

  process.nextTick( function () { cb( null ) } )
}

exports.listAgents = function ( asDI, asHost, cb ) {
  var ixDI = dummyNoSql[config.host.ix + ':di:' + asHost + ':' + asDI]
  var handles = dummyNoSql[config.host.ix + ':di:' + ixDI]
  process.nextTick( function () { cb( null, handles ) } )  
}

exports.deleteAgent = function ( asDI, asHost, handle, cb ) {
  var ixDI = dummyNoSql[config.host.ix + ':di:' + asHost + ':' + asDI]
  var result = {}
  delete dummyNoSql[config.host.ix + ':di:' + ixDI][handle]

  delete dummyNoSql[config.host.registrar + ':agentHandle:' + handle]

  var handleAS = dummyNoSql[config.host.ix + ':di:' + ixDI + ':handle:' + handle]
  process.nextTick( function () { cb( null, handleAS ) } )  
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

