/* 
* Database layer
*
* Copyright (C) Province of British Columbia, 2013
*/

var fs = require('fs')
  , config = require('./config')
  , crypto = require('crypto')
  , b64url = require('./b64url')
  , identity = require('./identity')
  , vaultIX = require('./ix/vault')

// Development JSON datastore  
// create empty file if does not exist

debugger;

var fExist = fs.existsSync( __dirname+'/nosql.json' )

if ( !fExist ) {
  fs.writeFileSync( __dirname+'/nosql.json', '{"keys": {}}' )
}
var dummyNoSql = require('./nosql.json')  


// save database on exit
process.on('exit', function() {
  fs.writeFileSync( __dirname+'/nosql.json', JSON.stringify( dummyNoSql ) )  
})

var keys = dummyNoSql.keys

// maps an IX DI to the directed id fo a host
function mapDI ( host, ixDI ) {
  var input = vaultIX.secret + host + ixDI
  var hash = crypto.createHash( 'sha1' )
  hash.update( input )
  var di = b64url.encode( hash.digest() )
  return di
}
exports.mapDI = mapDI

/*
* Registrar DB functions
*/
exports.validAgent = function ( handle, cb ) {
  var valid = dummyNoSql[config.host.registrar + ':agentHandle:' + handle]
  process.nextTick( function () { cb(  valid ) } )
}

exports.getAppName = function ( id, cb ) {
  var name = dummyNoSql[config.host.registrar + ':app:' + id + ':name']
  process.nextTick( function () { cb('Example App') } )
}

exports.checkRegistrarAppIdTaken = function ( id, cb ) {
  var taken = dummyNoSql.hasOwnProperty( config.host.registrar + ':app:' + id + ':name' )
  process.nextTick( function () { cb( null, taken ) } )
}

// called when an admin logs in to link email with DI
exports.registerAdmin = function ( adminEmail, di, cb ) {
  dummyNoSql[config.host.registrar + ':admin:' + adminEmail + ':di'] = di
  dummyNoSql[config.host.registrar + ':di:' + di + ':admin'] = adminEmail
  process.nextTick( function () { cb( null ) } )
}

// called when an RS wants to know if admin is authorized for an app ID
exports.checkAdminAuthorization = function ( id, di, cb ) {
  var adminEmail = dummyNoSql[config.host.registrar + ':di:' + di + ':admin'] 
  var authorized = dummyNoSql[config.host.registrar + ':app:' + id + ':admins'][adminEmail] == 'ACTIVE'
  process.nextTick( function () { cb( null, authorized ) } )
}


exports.newRegistrarApp = function ( id, name, adminEmail, cb ) {
  // add to DB
  dummyNoSql[config.host.registrar + ':app:' + id + ':name'] = name
  dummyNoSql[config.host.registrar + ':app:' + id + ':admins'] = {}
  dummyNoSql[config.host.registrar + ':app:' + id + ':admins'][adminEmail] = 'ACTIVE'
  dummyNoSql[config.host.registrar + ':admin:' + adminEmail + ':apps'] = {}
  dummyNoSql[config.host.registrar + ':admin:' + adminEmail + ':apps'][id] = 'ACTIVE'

  // add keys to Keys Vault
  keys[config.host.registrar] = keys[config.host.registrar] || {}
  var newKey = identity.makeKey()
  var o = {latest: newKey}
  o[newKey.kid] = newKey.key
  keys[config.host.registrar][id] = o

  process.nextTick( function () { cb( null, newKey ) } )
}

exports.addRegistrarAppAdmin = function ( id, admin, cb ) {
  dummyNoSql[config.host.registrar + ':app:' + id + ':admins'][admin] = 'ACTIVE'
  dummyNoSql[config.host.registrar + ':admin:' + admin + ':apps'][id] = 'ACTIVE'
  process.nextTick( function () { cb( null ) } )
}

exports.deleteRegistrarAppAdmin = function ( id, admin, cb ) {
  delete dummyNoSql[config.host.registrar + ':app:' + id + ':admins'][admin]
  delete dummyNoSql[config.host.registrar + ':admin:' + admin + ':apps'][id]
  process.nextTick( function () { cb( null ) } )
}

exports.deleteRegistrarApp = function ( id, cb ) {
  delete dummyNoSql[config.host.registrar + ':app:' + id + ':name']
  delete keys[config.host.registrar][id]
  var admins = Object( dummyNoSql[config.host.registrar + ':app:' + id + ':admins'] ).keys()
  admins.forEach( function (admin) {
    delete dummyNoSql[config.host.registrar + ':admin:' + admin + ':apps'][id]
  })
  process.nextTick( function () { cb( null ) } )
}

exports.refreshRegistrarAppKey = function ( id, cb ) {
  var newKey = identity.makeKey()
  var o = {latest: newKey}
  o[newKey.kid] = newKey.key
  keys[config.host.registrar][id] = o

  process.nextTick( function () { cb( null, newKey ) } )
}

exports.getRegistrarAppKey = function ( id, cb ) {
  var key = keys[config.host.registrar][id]
  process.nextTick( function () { cb( null, key ) } )
}

/*
* IX DB functions
*/
// creats a new User directed identifier and stores pointers from all AS
exports.newUser = function ( asHost, rsHosts, cb ) {
  // create and map identifiers
  var ixDI = identity.createDI()
  var dis = {}
  dis[asHost] = mapDI( asHost, ixDI )
  rsHosts.forEach( function ( host ) {
    dis[host] = mapDI( host, ixDI )
  })

  // store DI pointers
  dummyNoSql[config.host.ix + ':di:' + ixDI] = {}
  Object.keys( config.roles.as ).forEach( function (asHost) {
    var asDI = mapDI( asHost, ixDI )
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

