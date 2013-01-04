/* 
* Development Database layer
* 
* NOTE: will not work with cluster or other multi-process!!!
*
* Copyright (C) Province of British Columbia, 2013
*/

var fs = require('fs')
  , config = require('./config')
  , crypto = require('crypto')
  , b64url = require('./b64url')
  , identity = require('./identity')
  , vaultIX = require('./ix/vault')

// Development JSON DB  
// create empty file if does not exist
var fExist = fs.existsSync( __dirname+'/nosql.json' )
if ( !fExist ) {
  var nosql = {'keyChain': {} }
  fs.writeFileSync( __dirname+'/nosql.json', JSON.stringify( nosql ) )
}
// load DB
var dummyNoSql = require('./nosql.json')  


// save DB on exit
process.on('exit', function() {
  fs.writeFileSync( __dirname+'/nosql.json', JSON.stringify( dummyNoSql ) )  
})

var keyChain = dummyNoSql.keyChain

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
  var valid = dummyNoSql['registrar:agentHandle:' + handle]
  process.nextTick( function () { cb(  valid ) } )
}

exports.getAppName = function ( id, cb ) {
  var name = dummyNoSql['registrar:app:' + id + ':name']
  process.nextTick( function () { cb('Example App') } )
}

exports.checkRegistrarAppIdTaken = function ( id, cb ) {
  var taken = dummyNoSql.hasOwnProperty( config.host.registrar + ':app:' + id + ':name' )
  process.nextTick( function () { cb( null, taken ) } )
}



// called when an RS wants to know if admin is authorized for an app ID
exports.checkAdminAuthorization = function ( reg, id, di, cb ) {

debugger;

  var adminEmail = dummyNoSql[reg + ':admin:di:' + di] 
  var authorized = dummyNoSql[reg + ':app:' + id + ':admins'][adminEmail] == 'ACTIVE'
  process.nextTick( function () { cb( null, authorized ) } )
}

/*
* General Registration Functions
*/
// generate new app keys and add to Vault
function newKeyObj( reg, id ) {
  var keyObj = identity.makeKeyObj()
  keyChain[reg] = keyChain[reg] || {}
  keyChain[reg][id] = keyObj
  return keyObj
}

// called when an admin logs in to link email with DI
exports.registerAdmin = function ( reg, adminEmail, di, cb ) {
  dummyNoSql[reg + ':admin:' + adminEmail + ':di'] = di
  dummyNoSql[reg + ':admin:di:' + di] = adminEmail
  process.nextTick( function () { cb( null ) } )
}

exports.listApps = function ( reg, admin, cb ) {
  var apps = dummyNoSql[reg + ':admin:' + admin + ':apps']
  var result = {}
  if (apps) {
    Object.keys(apps).forEach( function (id) {
      result[id] =
        { name: dummyNoSql[reg + ':app:' + id + ':name']
        , admins: dummyNoSql[reg + ':app:' + id + ':admins']
        }
    })    
  }
  process.nextTick( function () { cb( null, result ) } )
}

exports.newApp = function ( reg, id, name, adminEmail, cb ) {
  // add to DB
  dummyNoSql[reg + ':app:' + id + ':name'] = name
  dummyNoSql[reg + ':app:' + id + ':admins'] = {}
  dummyNoSql[reg + ':app:' + id + ':admins'][adminEmail] = 'ACTIVE'
  dummyNoSql[reg + ':admin:' + adminEmail + ':apps'] = dummyNoSql[reg + ':admin:' + adminEmail + ':apps'] || {}
  dummyNoSql[reg + ':admin:' + adminEmail + ':apps'][id] = 'ACTIVE'
  // gen key pair
  var keyObj = newKeyObj( reg, id )
  process.nextTick( function () { cb( null, keyObj ) } )
}

exports.addAppAdmin = function ( reg, id, admin, cb ) {
  dummyNoSql[reg + ':app:' + id + ':admins'][admin] = 'ACTIVE'
  dummyNoSql[reg + ':admin:' + admin + ':apps'][id] = 'ACTIVE'
  process.nextTick( function () { cb( null ) } )
}

exports.deleteAppAdmin = function ( reg, id, admin, cb ) {
  delete dummyNoSql[reg + ':app:' + id + ':admins'][admin]
  delete dummyNoSql[reg + ':admin:' + admin + ':apps'][id]
  process.nextTick( function () { cb( null ) } )
}

exports.deleteApp = function ( reg, id, cb ) {
  delete dummyNoSql[reg + ':app:' + id + ':name']
  delete keyChain[reg][id]
  var admins = Object( dummyNoSql[reg + ':app:' + id + ':admins'] ).keys()
  admins.forEach( function (admin) {
    delete dummyNoSql[reg + ':admin:' + admin + ':apps'][id]
  })
  process.nextTick( function () { cb( null ) } )
}

exports.refreshAppKey = function ( reg, id, cb ) {
  var keyObj = newKeyObj( reg, id )
  process.nextTick( function () { cb( null, keyObj ) } )
}

exports.getAppKey = function ( reg, id, vaultKeys, cb ) {
  var key = null
  if (reg)
    key = keyChain[reg][id]
  if (!key && vaultKeys) {
    key = vaultKeys[id]
  }
  process.nextTick( function () { cb( null, key ) } )
}

exports.getAppKeys = function ( reg, list, vaultKeys, cb ) {
  var keys = {}
    , notFound = false
    , e = null

  list.forEach( function (id) {
    keys[id] = keyChain[reg][id]
    if (!keys[id] && vaultKeys && vaultKeys[id]) {
      keys[id] = vaultKeys[id]
    } 
    if (!keys[id]) notFound = id
  })
  if (notFound) {
    e = new Error('Key not found for:'+notFound)
    e.code = "UNKOWN_RESOURCE"
  }
  process.nextTick( function () { cb( e, keys ) } )  
}

/*
* IX DB functions
*/
// creats a new User directed identifier and stores pointers from all AS
exports.newUser = function ( asHost, rsHosts, redirects, cb ) {
  // create and map identifiers
  var ixDI = identity.createDI()
  var dis = {}
  dis[asHost] = mapDI( asHost, ixDI )
  rsHosts.forEach( function ( host ) {
    dis[host] = mapDI( host, ixDI )
  })

  // store DI pointers
  dummyNoSql['ix:di:' + ixDI] = {}
  Object.keys( config.roles.as ).forEach( function (asHost) {
    var asDI = mapDI( asHost, ixDI )
    dummyNoSql['ix:di:' + asHost + ':' + asDI] = ixDI
  })

  // store any redirects
  if (redirects) {
    Object.keys( redirects ).forEach( function (std) {
      dummyNoSql['ix:redirect:di:' + ixDI + ':' + std] = dummyNoSql['ix:redirect:di:' + ixDI + ':' + std] || []
      dummyNoSql['ix:redirect:di:' + ixDI + ':' + std].push( redirects[std] )
    })
  }
  
  process.nextTick( function () { cb( null, dis ) } )
}

// gets any redirected hosts for stored for any standardized resources passed in
exports.getStandardResourceHosts = function ( asDI, asHost, rsList, cb ) {
  var rsStd = rsList.filter( function (rs) { return config.roles.std[rs] } )
  if (!rsStd) {
    return process.nextTick( function () { cb( null, null ) } )
  }
  var ixDI = dummyNoSql['ix:di:' + asHost + ':' + asDI]
  var redirects = {}
  rsStd.forEach( function ( std ) {
    redirects[std] = dummyNoSql['ix:redirect:di:' + ixDI + ':' + std]
  })  
  process.nextTick( function () { cb( null, redirects ) } )
}


// gets DIs for each RS from AS DI
exports.getRsDIfromAsDI = function ( asDI, asHost, rsHosts, cb ) {
  var ixDI = dummyNoSql['ix:di:' + asHost + ':' + asDI]
  var rsDI = {}
  rsHosts.forEach( function (rsHost) {
    rsDI[rsHost] = mapDI( rsHost, ixDI )
  })

  process.nextTick( function () { cb( null, rsDI ) } )
}


// functions to add, list and delete agents from DB
exports.addAgent = function ( asDI, asHost, handle, name, cb ) {
  var ixDI = dummyNoSql['ix:di:' + asHost + ':' + asDI]
  dummyNoSql['ix:di:' + ixDI][handle] = name
  dummyNoSql['ix:di:' + ixDI + ':handle:' + handle] = asHost

  dummyNoSql['registrar:agentHandle:' + handle] = true

  process.nextTick( function () { cb( null ) } )
}

exports.listAgents = function ( asDI, asHost, cb ) {
  var ixDI = dummyNoSql['ix:di:' + asHost + ':' + asDI]
  var handles = dummyNoSql['ix:di:' + ixDI]
  process.nextTick( function () { cb( null, handles ) } )  
}

exports.deleteAgent = function ( asDI, asHost, handle, cb ) {
  var ixDI = dummyNoSql['ix:di:' + asHost + ':' + asDI]
  var result = {}
  delete dummyNoSql['ix:di:' + ixDI][handle]

  delete dummyNoSql['registrar:agentHandle:' + handle]

  var handleAS = dummyNoSql['ix:di:' + ixDI + ':handle:' + handle]
  process.nextTick( function () { cb( null, handleAS ) } )  
}


// TBD - delete and use channels instead

exports.storeAgentRegisterSessionValue = function ( id, label, data, cb ) {
  var key = 'as:agentRegisterSession:' + id
  dummyNoSql[key] = dummyNoSql[key] || {}
  dummyNoSql[key][label] = data
  process.nextTick( function () { cb( null ) } )
}

exports.retrieveAgentRegisterSession = function ( id, cb ) {
  process.nextTick( function () {
    var key = 'as:agentRegisterSession:' + id
    cb( null, dummyNoSql[key] )
  })
}

/*
* Agent DB functions
*/

exports.storeAgent = function ( as, agent, cb ) {
  var key = as + ':agent:device:' + agent.device
  dummyNoSql[key] = agent
  key = as + ':agent:handle:' + agent.handle
  dummyNoSql[key] = agent.device
  process.nextTick( function () { cb( null ) } )
}

exports.retrieveAgentFromDevice = function ( as, device, cb) {
  var key = as + ':agent:device:' + device
  var agent = dummyNoSql[key]
  process.nextTick( function () { cb( null, agent ) } )
}

exports.retrieveAgentFromHandle = function ( as, handle, cb) {
  var key = as + ':agent:handle:' + handle
  var device = dummyNoSql[key]
  var key = as + ':agent:device:' + device
  var agent = dummyNoSql[key]
  process.nextTick( function () { cb( null, agent ) } )  
}

exports.deleteAgentFromHandle = function ( as, handle, cb) {
  var key = as + ':agent:handle:' + handle
  var device = dummyNoSql[key]
  delete dummyNoSql[key]
  var key = as + ':agent:device:' + device
  delete dummyNoSql[key]
  process.nextTick( function () { cb( null ) } )  
}

/*
* Resource Server DB Functions
*/
exports.updateProfile = function ( rs, di, profile, cb ) {
  var key = rs + ':di:' + di + ':profile'
  dummyNoSql[key] = dummyNoSql[key] || {}
  Object.keys( profile ).forEach( function (item) {
    dummyNoSql[key][item] = profile[item]
  })
  process.nextTick( function () { cb( null ) } )  
}

exports.getProfile = function ( rs, di, cb ) {
  var key = rs + ':di:' + di + ':profile'
  if (!dummyNoSql[key]) {
    var e = new Error('unknown user')
    e.code = "UNKNOWN_USER"
    process.nextTick( function () { cb( e, null ) } )    
  } else {
    process.nextTick( function () { cb( null, dummyNoSql[key] ) } )    
  }
}


exports.updateSeries = function ( rs, di, series, data, time, cb ) {
  time = time || new Date().now()
  var key = rs + ':di:' + di + ':series:' + series
  dummyNoSql[key] = dummyNoSql[key] || {}
  dummyNoSql[key][time] = data
  process.nextTick( function () { cb( null ) } )  
}


exports.getSeries = function ( rs, di, series, data, cb ) {
  var key = rs + ':di:' + di + ':series:' + series
  process.nextTick( function () { cb( null, dummyNoSql[key] ) } )  
}

/*
* dev version of publish / subscribe
* used to move IX Token between phone and desktop 
* when using QR reader
*/

var channels = {}

exports.writeChannel = function ( channel, data ) {
  channels[channel] = data
}

exports.readChannel = function ( channel, cb) {
  var id = setInterval( function() {
    if (channels[channel]) {
      clearInterval( id )
      var data = channels[channel]
      delete channels[channel]
      cb( null, data )
    }
  }, 10)
}

