/*
* Development Database layer
*
* NOTE: will not work with cluster or other multi-process!!!
*
* Copyright (C) Province of British Columbia, 2013
*/

var fs = require('fs')
  , underscore = require('underscore')
  , async = require('async')
  , config = require('../config')
  , crypto = require('crypto')
  , b64url = require('./b64url')
  , identity = require('./identity')
  , vaultIX = require('../ix/vault')
  , jwt = require('./jwt')

// Development JSON DB
// create empty file if does not exist
var fExist = fs.existsSync( config.rootAppDir+'/nosql.json' )
if ( !fExist ) {
  var nosql = {'keyChain': {} }
  fs.writeFileSync( config.rootAppDir+'/nosql.json', JSON.stringify( nosql ) )
}
// load DB
var dummyNoSql = require('../nosql.json')
var keyChain = dummyNoSql.keyChain

exports.initialize = function (dbNumber, cb) {
  process.nextTick( function () { cb( null ) } )
}

// save DB state
exports.saveSync = function saveSync () {
  fs.writeFileSync( config.rootAppDir+'/nosql.json', JSON.stringify( dummyNoSql ) )
}

// syncronous save of DB to snapshot
var SNAPSHOTFILE = config.rootAppDir+'/snapshot.nosql.json'

exports.saveSnapshotSync = function saveSnapshotSync ( name ) {
  var fName = (name) ? config.rootAppDir + '/' + name + '.snapshot.nosql.json' : SNAPSHOTFILE
  return fs.writeFileSync( fName, JSON.stringify( dummyNoSql ) )
}

// syncronous restore of DB from last snapshot
exports.restoreSnapshotSync = function restoreSnapshotSync ( name ) {
  var fName = (name) ? config.rootAppDir + '/' + name + '.snapshot.nosql.json' : SNAPSHOTFILE
  if ( fs.existsSync( fName ) ) {
    var data = fs.readFileSync( fName )
    fs.writeFileSync( config.rootAppDir+'/nosql.json', data )
    dummyNoSql = JSON.parse(data)
    keyChain = dummyNoSql.keyChain
    return null
  } else {
    return new Error( fName + ' could not be found')
  }
}

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
*   Functions to create, get and delete Key Objects
*/
// generate new app keys and add to Vault
function newKeyObj ( reg, id, cb ) {
  var keyObj = identity.makeKeyObj()
  keyChain[reg] = keyChain[reg] || {}
  keyChain[reg][id] = keyObj
  process.nextTick( function () { cb( null, keyObj ) } )
}

function getKeyObj ( reg, id, cb ) {
  var keyObj = null
  if ( keyChain[reg] && keyChain[reg][id] )
    keyObj = keyChain[reg][id]
  process.nextTick( function () { cb( null, keyObj ) } )
}

function deleteKeyObj ( reg, id, cb ) {
  if ( keyChain[reg] && keyChain[reg][id] )
    delete keyChain[reg][id]
  process.nextTick( function () { cb( null ) } )
}


/*
* functions to add, list and delete agents from IX and Registrar DB
*/
exports.addAgent = function ( asDI, asHost, name, cb ) {
  var ixDI = dummyNoSql['ix:di:' + asHost + ':' + asDI]
 //  var registrarDI = mapDI( config.host.registrar, ixDI )
  var handle = jwt.handle()
  var token = jwt.handle()
  dummyNoSql['ix:di:' + ixDI] = dummyNoSql['ix:di:' + ixDI] || {}
  dummyNoSql['ix:di:' + ixDI][handle] = { 'name': name, 'AS': asHost, 'created': Date.now() }
  dummyNoSql['ix:di:' + ixDI + ':handle:' + handle + ':token'] = token
  dummyNoSql['registrar:agentHandle:' + token] = ixDI // registrarDI - need ixDI to map to RS for Authorization calls
  process.nextTick( function () { cb( null, token, handle ) } )
}

exports.listAgents = function ( asDI, asHost, cb ) {
  var ixDI = dummyNoSql['ix:di:' + asHost + ':' + asDI]
  var agents = dummyNoSql['ix:di:' + ixDI]
  if (!agents || !Object.keys(agents).length) {
    return process.nextTick( function () { cb( null, null ) } )
  }
  // don't want to share agent AS with other AS, just return what is needed for User to decide
  var results = {}
  Object.keys(agents).forEach( function ( handle ) {
    results[handle] =
      { name: agents[handle].name
      , created: agents[handle].created
      }
  })
  process.nextTick( function () { cb( null, results ) } )
}

exports.deleteAgent = function ( asDI, asHost, handle, cb ) {
  var ixDI = dummyNoSql['ix:di:' + asHost + ':' + asDI]
  var agentAS = dummyNoSql['ix:di:' + ixDI][handle] && dummyNoSql['ix:di:' + ixDI][handle].AS
  if (!agentAS) {
    return cb('HANDLE_NOT_FOUND')
  }
  var token = dummyNoSql['ix:di:' + ixDI + ':handle:' + handle + ':token']
  delete dummyNoSql['ix:di:' + ixDI][handle]
  delete dummyNoSql['ix:di:' + ixDI + ':handle:' + handle + ':token']
  delete dummyNoSql['registrar:agentHandle:' + token]

  process.nextTick( function () { cb( null, agentAS ) } )
}


/*
* Registrar DB functions
*/
exports.validAgent = function ( token, cb ) {
  var di = dummyNoSql['registrar:agentHandle:' + token]
  process.nextTick( function () { cb(  di ) } )
}

exports.getAppName = function ( id, cb ) {
  var name = dummyNoSql['registrar:app:' + id + ':name']
  process.nextTick( function () { cb( null, name ) } )
}

exports.checkRegistrarAppIdTaken = function ( id, cb ) {
  var taken = dummyNoSql.hasOwnProperty( config.host.registrar + ':app:' + id + ':name' )
  process.nextTick( function () { cb( null, taken ) } )
}

// called when an RS wants to know if admin is authorized for an app ID
exports.checkAdminAuthorization = function ( reg, id, di, cb ) {
  var e = null
  var adminEmail = dummyNoSql[reg + ':admin:di:' + di]
  if (adminEmail && dummyNoSql[reg + ':app:' + id + ':admins']) {
    var authorized = dummyNoSql[reg + ':app:' + id + ':admins'][adminEmail] == 'ACTIVE'
    return process.nextTick( function () { cb( null, authorized ) } )
  }
  // something was wrong
  if (!adminEmail) {
    e = new Error('Unknown administrator')
    e.code = 'UNKNOWN_USER'
    return process.nextTick( function () { cb( e) } )
  }
  if (!dummyNoSql[reg + ':app:' + id + ':admins']) {
    e = new Error('Unknown application "'+id+'"')
    e.code = 'UNKNOWN_APP'
    return process.nextTick( function () { cb( e) } )
  }
}

/*
* General App Registration Functions
*/


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
        { name: dummyNoSql[reg + ':app:' + id + ':name'] }
    })
  }
  process.nextTick( function () { cb( null, result ) } )
}

exports.appDetails = function ( reg, admin, id, cb ) {
  if (!dummyNoSql[reg + ':admin:' + admin + ':apps'][id]) {
    var e = new Error('Admin is not authorative for '+id)
    e.code = "ACCESS_DENIED"
    process.nextTick( function () { cb( e ) } )
  }
  getKeyObj( reg, id, function ( e, keys ) {
    if (e) return cb( e )
    var result =
      { name: dummyNoSql[reg + ':app:' + id + ':name']
      , admins: dummyNoSql[reg + ':app:' + id + ':admins']
      , keys: keys
      }
    if (reg == 'registrar')
      result.anytime = dummyNoSql[reg + ':app:' + id + ':anytime']
    process.nextTick( function () { cb( null, result ) } )
  })
}


// anytime parameter is optional, and indicates if a RS
// supports anytime OAuth 2.0 access and the
// /authorizations/list & /authorization/delete APIs
exports.newApp = function ( reg, id, name, adminEmail, anytime, cb ) {
  if (typeof anytime === 'function') {
    cb = anytime
    anytime = false
  }
  if ( dummyNoSql[reg + ':app:' + id + ':name'] ) {
    var err = new Error('"'+ id + '" already registered')
    err.code = 'APP_ID_ALREADY_REGISTERED'
    return process.nextTick( function () { cb( err ) } )
  }
  // add to DB
  dummyNoSql[reg + ':app:' + id + ':name'] = name
  if ( (reg == 'registrar') && anytime)
    dummyNoSql[reg + ':app:' + id + ':anytime'] = true
  dummyNoSql[reg + ':app:' + id + ':admins'] = {}
  dummyNoSql[reg + ':app:' + id + ':admins'][adminEmail] = 'ACTIVE'
  dummyNoSql[reg + ':admin:' + adminEmail + ':apps'] = dummyNoSql[reg + ':admin:' + adminEmail + ':apps'] || {}
  dummyNoSql[reg + ':admin:' + adminEmail + ':apps'][id] = 'ACTIVE'
  // gen key pair
  newKeyObj( reg, id, function ( e, keyObj ) {
    cb( e, keyObj )
  })
}

exports.checkApp = function ( reg, id, di, cb) {
  var e = null
    , ok = null
    , name = null
  var email = dummyNoSql[reg + ':admin:di:' + di]
  if (!email) {
    e = new Error('unknown administrator')
    e.code = 'UNKNOWN_USER'
  } else {
    var key = reg + ':app:' + id + ':admins'
    ok = ( dummyNoSql[key] && ( dummyNoSql[key][email] == 'ACTIVE' ) )
    if (!ok) {
      e = new Error('Account not authorative for '+id)
      e.code = 'ACCESS_DENIED'
    }
  }
  if (ok) name =  dummyNoSql[reg + ':app:' + id + ':name']
  process.nextTick( function () { cb( e, name ) } )
}

exports.addAppAdmin = function ( reg, id, admin, cb ) {
  dummyNoSql[reg + ':app:' + id + ':admins'][admin] = 'ACTIVE'
  dummyNoSql[reg + ':admin:' + admin + ':apps'] = dummyNoSql[reg + ':admin:' + admin + ':apps'] || {}
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
  deleteKeyObj( reg, id, function ( e ) {
    var admins = Object.keys( dummyNoSql[reg + ':app:' + id + ':admins'] )
    admins.forEach( function (admin) {
      delete dummyNoSql[reg + ':admin:' + admin + ':apps'][id]
    })
    process.nextTick( function () { cb( null ) } )
  })
}

exports.refreshAppKey = function ( reg, id, cb ) {
  newKeyObj( reg, id, function ( e, keyObj ) {
    cb( e, keyObj )
  })
}

exports.getAppKey = function ( reg, id, vaultKeys, cb ) {
  getKeyObj( reg, id, function ( e, key) {
    if (!key) key = vaultKeys[id]
    if (!key) cb( new Error('No key found for "'+id+'"') )
    cb( null, key )
  })
}

// used by Registrar to check if list of RS are Anytime and then get keys
exports.getAnytimeAppKeys = function ( list, vaultKeys, cb ) {
  var tasks = {}
  list.forEach( function ( id ) {
    if (dummyNoSql['registrar:app:' + id + ':anytime']) {
      tasks[id] = function ( done ) {
        getKeyObj( 'registrar', id, function ( e, keyObj ) {
          if (e) return done( e )
          if (!keyObj && vaultKeys) {
            keyObj = vaultKeys[id]
          }
          done( e, keyObj )
        })
      }
    }
  })
  async.parallel( tasks, cb )
}

// get Keys for all the apps in the list
exports.getAppKeys = function ( reg, list, vaultKeys, cb ) {
  var tasks = {}
  list.forEach( function ( id ) {
    tasks[id] = function ( done ) {
      getKeyObj( reg, id, function ( e, keyObj ) {
        if (e) return done( e )
        if (!keyObj && vaultKeys) {
          keyObj = vaultKeys[id]
        }
        done( null, keyObj )
      })
    }
  })
  async.parallel( tasks, cb )
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
* AS DB functions for Agents
*/

exports.storeAgent = function ( as, agent, cb ) {
  var key = as + ':agent:device:' + agent.device
  dummyNoSql[key] = agent
  key = as + ':agent:handle:' + agent.handle
  dummyNoSql[key] = agent.device
  process.nextTick( function () { cb( null ) } )
}

exports.retrieveAgentFromHandle = function ( as, handle, cb) {
  var key = as + ':agent:handle:' + handle
  var device = dummyNoSql[key]
  key = as + ':agent:device:' + device
  var agent = dummyNoSql[key]
  process.nextTick( function () { cb( null, agent ) } )
}

exports.retrieveAgentFromDevice = function ( as, device, cb) {
  var key = as + ':agent:device:' + device
  var agent = dummyNoSql[key]
  process.nextTick( function () { cb( null, agent ) } )
}

exports.deleteAgentFromHandle = function ( as, handle, cb) {
  var key = as + ':agent:handle:' + handle
  var device = dummyNoSql[key]
  delete dummyNoSql[key]
  key = as + ':agent:device:' + device
  delete dummyNoSql[key]
  process.nextTick( function () { cb( null ) } )
}

/*
* Resource Server DB Functions
*/
exports.updateProfile = function ( rs, di, profile, cb ) {
  var key = rs + ':di:' + di + ':profile'

// console.log('\nupdateProfile from:',key)
// console.log('profile\n',profile)


  dummyNoSql[key] = dummyNoSql[key] || {}
  Object.keys( profile ).forEach( function (item) {
    dummyNoSql[key][item] = profile[item]
  })
  process.nextTick( function () { cb( null ) } )
}

exports.getProfile = function ( rs, di, cb ) {
  var key = rs + ':di:' + di + ':profile'

// console.log('\ngetProfile from:',key)
// console.log('profile\n',dummyNoSql[key])

  if (!dummyNoSql[key]) {
    var e = new Error('unknown user')
    e.code = "UNKNOWN_USER"
    process.nextTick( function () { cb( e, null ) } )
  } else {
    process.nextTick( function () { cb( null, dummyNoSql[key] ) } )
  }
}

exports.deleteProfile = function ( rs, di, cb ) {
  var key = rs + ':di:' + di + ':profile'
    , e = null
  if (dummyNoSql[key]) {
    delete dummyNoSql[key]
  } else {
    e = new Error('unknown user')
    e.code = "UNKNOWN_USER"
  }
  process.nextTick( function () { cb( e ) } )
}


exports.updateSeries = function ( rs, di, series, data, time, cb ) {
  if (time instanceof String) time = Date.parse(time)
  time = time || Date().now()
  var key = rs + ':di:' + di + ':series:' + series
  dummyNoSql[key] = dummyNoSql[key] || {}
  dummyNoSql[key][time] = data
  process.nextTick( function () { cb( null ) } )
}


exports.retrieveSeries = function ( rs, di, series, cb ) {
  var key = rs + ':di:' + di + ':series:' + series
  process.nextTick( function () { cb( null, dummyNoSql[key] ) } )
}

/*
* dev version of publish / subscribe
* used to move IX Token between phone and desktop
* when using QR reader
*/

var EventEmitter = require('events').EventEmitter
var channels = new EventEmitter()

exports.writeChannel = function ( channel, data ) {

  if (typeof data === 'object') {
    data = JSON.stringify( data)
  }
  channels.emit( channel, data )
}

exports.readChannel = function ( channel, cb) {
  channels.once( channel, function ( data ) {
    try {
      data = JSON.parse( data )
    }
    catch (e) {
      cb( null, data )
    }
    cb( null, data )
  })
}

/*
* OAuth Access Tokens and permissions
*
*/
// create an OAuth access token
exports.oauthCreate = function ( rs, details, cb) {
  var accessToken = jwt.handle()
  var appID = details.app
  var keyAccess = rs + ':oauth:' + accessToken
  // NOTE: an App may have multiple Access Tokens, and with different priveleges
  dummyNoSql[keyAccess] = details
  dummyNoSql[keyAccess].created = Date.now()
  dummyNoSql[keyAccess].lastAccess = Date.now()
  var keyDI = rs + ':oauthGrants:' + details.sub
  dummyNoSql[keyDI] = dummyNoSql[keyDI] || {}
  dummyNoSql[keyDI][accessToken] = appID
  process.nextTick( function () { cb( null, accessToken ) } )
}

// retrieve an OAuth access token, reset last access
exports.oauthRetrieve = function ( rs, accessToken, cb ) {
  var keyAccess = rs + ':oauth:' + accessToken
  if ( !dummyNoSql[keyAccess] ) {
    var e = new Error('Invalid Access Token:'+accessToken)
    e.code = "INVALID_ACCESS_TOKEN"
    return process.nextTick( function() { cb( e ) } )
  }
  // we want to send current state of details so that
  // we know last time was accessed
  var details = JSON.parse( JSON.stringify( dummyNoSql[keyAccess] ) ) // clone object
  dummyNoSql[keyAccess].lastAccess = Date.now()
  process.nextTick( function () { cb( null, details ) } )
}

// list which apps have been granted OAuth access tokens
exports.oauthList = function ( rs, di, cb ) {
  var keyDI = rs + ':oauthGrants:' + di
  var grants = dummyNoSql[keyDI]
  if (!grants) return process.nextTick( function () { cb( null ) } )
  var results = {}
  Object.keys( grants ).forEach( function ( accessToken ) {
    var keyAccess = rs + ':oauth:' + accessToken
    var details = dummyNoSql[keyAccess]
    var appID = details.app
    results[appID] = results[appID] || {}
    var lastAccess = results[appID].lastAccess || details.lastAccess
    if (lastAccess <= details.lastAccess) results[appID].lastAccess = details.lastAccess
    results[appID].name = dummyNoSql[rs + ':app:' + appID + ':name']
    results[appID].resources = results[appID].resources || []
    results[appID].resources = underscore.union( results[appID].resources, details.scopes )
  })
  process.nextTick( function () { cb( null, results ) } )
}

// delete all OAuth access tokens granted to an app
exports.oauthDelete = function ( rs, di, appID, cb ) {
  var keyDI = rs + ':oauthGrants:' + di
  var grants = dummyNoSql[keyDI]
  Object.keys( grants ).forEach( function ( accessToken ) {
    if ( grants[accessToken] == appID ) {
      var keyAccess = rs + ':oauth:' + accessToken
      delete dummyNoSql[keyAccess]
      delete dummyNoSql[keyDI][accessToken]
    }
  })
  process.nextTick( function () { cb( null ) } )
}


// AS notification URL info

exports.createNotificationCode = function ( device, cb ) {
  var code = jwt.handle()
  var key = 'as:notification:'+code
  dummyNoSql[key] = device
  process.nextTick( function () { cb( code ) } )
}

exports.getDeviceFromNotificationCode = function ( code, cb ) {
  var key = 'as:notification:'+code
  var device = dummyNoSql[key]
  process.nextTick( function () { cb( device ) } )
}

// App Reporting

exports.logAgentReport = function ( token, request, appID, cb ) {
  var agentKey = 'registrar:report:agent:' + token
  var appKey = 'registrar:report:app:' + appID
  var reportsKey = 'registrar:report'
  var time = Date.now()
  dummyNoSql[agentKey] = dummyNoSql[agentKey] || {}
  dummyNoSql[agentKey][time] = request
  dummyNoSql[appKey] = dummyNoSql[appKey] || {}
  dummyNoSql[appKey][token] =  time
  dummyNoSql[reportsKey] = dummyNoSql[reportsKey] || []
  dummyNoSql[reportsKey][appID] = time
  process.nextTick( function () { cb( null ) } )
}

exports.getReportedApps = function ( cb ) {
  var reportsKey = 'registrar:report'
  var result = dummyNoSql[reportsKey]
  process.nextTick( function () { cb( null, result) } )
}

exports.getAppReports = function ( appID, cb ) {
  var appKey = 'registrar:report:app:' + appID
  var result = dummyNoSql[appKey]
  process.nextTick( function () { cb( null, result) } )
}

exports.getAgentReports = function ( token, cb ) {
  var agentKey = 'registrar:report:agent:' + token
  var result = dummyNoSql[agentKey]
  process.nextTick( function () { cb( null, result) } )
}

