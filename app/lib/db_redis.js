/*
* REDIS Database layer
*
* Copyright (C) Province of British Columbia, 2013
*/

var fs = require('fs')
  , underscore = require('underscore')
  , async = require('async')
  , redis = require('redis')
  , config = require('../config')
  , crypto = require('crypto')
  , b64url = require('./b64url')
  , identity = require('./identity')
  , vaultIX = require('../ix/vault')
  , jwt = require('./jwt')

/*
* initialize DB
*
*/

var db = null
exports._db = db   // for testing

exports.initialize = function (dbNumber, cb) {

  if (!config.database.host) return cb("No config.database.host configured!")
  if (!config.database.port) return cb("No config.database.port configured!")

  if (!dbNumber) dbNumber = 0
  var callback = cb // allows us to track if we have called back

  // Redis handlers
  var error = function (err) {
    console.error("Redis ERROR: " + err)
    if (callback) {
      callback( err )
      callback = null
    }
  }

  var connect = function () {
    console.log("Redis connected at " + db.host + ":" + db.port + ".")
  }

  var ready = function () {
    console.log("Redis "+db.server_info.redis_version+" ready.")
    db.select( dbNumber, function (err, res) {
      if (!err) {
        console.log("Redis DB " + dbNumber + " selected.")
        if (callback) {
          callback( null )
          callback = null
        }
      } else {
        console.error("Redis SELECT error:" + err)
      }
    })
  }

  var reconnecting = function (arg) {
    console.log("Redis reconnecting: ", arg)
  }

    // init logic
  if (db) {
    console.error("Database already initialized.")
    return callback("Database already initialized.")
  }

  console.log("Redis attempting connection to " + config.database.host + ":" + config.database.port + ".")
  db = redis.createClient( config.database.port, config.database.host )

  // setup handlers
  db.on("error", error)
  db.on("ready", ready)
  db.on("connect", connect)
  db.on("reconnecting", reconnecting)

  if (config.database.password) {
    db.auth( config.database.password, function (err, res) {
      if (res == 'OK') {
        console.log("Redis AUTH successful.")
      } else {
        console.error("Redis AUTH error:" + err)
      }
    })
  }

}


/*
*   clear the database. Yes, like really throw everything away!
*   used for test scripts and debugging
*/
exports.flushdb = function ( cb ) {
  db.flushdb( cb )
}

exports.quit = function ( cb ) {
  db.quit( cb )
}

exports.saveSync = function () {
  // TBD save the DB -- can we do this syncronously????
  //console.error( 'db.saveSync() to be implemnted!!!' )
}

exports.saveSnapshotSync = function ( name ) {
  // TBD
  //console.error( 'db.saveSnapshotSync() to be implemnted!!!', name )
}

exports.restoreSnapshotSync = function  ( name ) {
  // TBD
 // console.error( 'db.restoreSnapshotSync() to be implemnted!!!', name )
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
  var keyStr = JSON.stringify( keyObj )
  db.hset( 'keychain:'+reg, id, keyStr, function( e ) {
    if (e) return cb( e )
    cb( null, keyObj )
  })
}

function getKeyObj ( reg, id, cb ) {
  db.hget( 'keychain:'+reg, id, function ( e, keyStr ) {
    if (e) return cb( e )
    var keyObj = null
    try {
      keyObj = JSON.parse( keyStr )
    }
    catch( e ) {
      return cb( e )
    }
    cb( null, keyObj)
  })
}

function deleteKeyObj ( reg, id, cb ) {
  db.hdel( 'keychain:'+reg, id, cb )
}


/*
* functions to add, list and delete agents from IX and Registrar DB
*/
exports.addAgent = function ( asDI, asHost, name, cb ) {
  db.get( 'ix:di:' + asHost + ':' + asDI, function( e, ixDI ) {
    if (e) return cb( e )
   //  var registrarDI = mapDI( config.host.registrar, ixDI )
    var handle = jwt.handle()
    var token = jwt.handle()
    var agentObj = { 'name': name, 'AS': asHost, 'created': Date.now() }
    var agentStr = JSON.stringify( agentObj )

    db.multi()
      .hset( 'ix:di:' + ixDI, handle, agentStr )
      .set( 'ix:di:' + ixDI + ':handle:' + handle + ':token', token )
      .set( 'registrar:agentHandle:' + token, ixDI )  // registrarDI - need ixDI to map to RS for Authorization calls
      .exec( function ( e ) {
        return cb( e, token, handle )
      })
  })
}

exports.listAgents = function ( asDI, asHost, cb ) {
  db.get( 'ix:di:' + asHost + ':' + asDI, function( e, ixDI ) {
    if (e) return cb( e )
    db.hgetall( 'ix:di:' + ixDI, function ( e, agents ) {
      if ( e ) return cb( e )

// console.log('db.listAgents() agents',agents)

      if (!agents) {
        return cb( null, null )
      }
      // don't want to share agent AS with other AS, just return what is needed for User to decide
      var results = {}
      Object.keys(agents).forEach( function ( handle ) {
        var agentObj = null
        try { agentObj = JSON.parse( agents[handle] ) }
        catch(e) { return cb( e ) }
        results[handle] =
          { name: agentObj.name
          , created: agentObj.created
          }
      })
      cb( null, results )
    })
  })
}

exports.deleteAgent = function ( asDI, asHost, handle, cb ) {
  db.get( 'ix:di:' + asHost + ':' + asDI, function( e, ixDI ) {
    if (e) return cb( e )
    db.hget( 'ix:di:' + ixDI, handle, function ( e, agentStr ) {
      var agentObj = null
      try { agentObj = JSON.parse( agentStr ) }
      catch(e) { return cb( e ) }
      db.get( 'ix:di:' + ixDI + ':handle:' + handle + ':token', function ( e, token ) {
        if ( e ) return cb( e )
        if ( !token ) return cb('HANDLE_NOT_FOUND')
        db.hdel( 'ix:di:' + ixDI, handle )
        db.del( 'ix:di:' + ixDI + ':handle:' + handle + ':token' )
        db.del( 'registrar:agentHandle:' + token )
        cb( null, agentObj.AS )
      })
    })
  })
}


/*
* Registrar DB functions
*/
exports.validAgent = function ( token, cb ) {
  db.get( 'registrar:agentHandle:' + token, function ( e, di ) {
    cb(  di )
  })
}

exports.getAppName = function ( id, cb ) {
  db.hget( 'registrar:app:' + id, 'name', cb )
}

exports.checkRegistrarAppIdTaken = function ( id, cb ) {
  db.get( config.host.registrar + ':app:' + id + ':name', cb )
}

// called when an RS wants to know if admin is authorized for an app ID
exports.checkAdminAuthorization = function ( reg, id, di, cb ) {
  db.get( reg + ':admin:di:' + di, function ( e, adminEmail ) {
    if ( e ) return cb( e )
    if (!adminEmail) {
      e = new Error('Unknown administrator')
      e.code = 'UNKNOWN_USER'
      return cb( e )
    }
    db.hget( reg + ':app:' + id + ':admins', adminEmail, function ( e, status ) {
      if ( e ) return cb( e )
      if ( !status ) {
        e = new Error('Unknown application "'+id+'"')
        e.code = 'UNKNOWN_APP'
        return cb( e )
      }
      cb( null, status == 'ACTIVE' )
    })
  })
}


/*
* General App Registration Functions
*/
// called when an admin logs in to link email with DI
exports.registerAdmin = function ( reg, adminEmail, di, cb ) {
  db.multi()
    .set( reg + ':admin:' + adminEmail + ':di', di )
    .set( reg + ':admin:di:' + di, adminEmail )
    .exec( cb )
}

exports.listApps = function ( reg, admin, cb ) {
  db.hgetall( reg + ':admin:' + admin + ':apps', cb )
  // var apps = dummyNoSql[reg + ':admin:' + admin + ':apps']
  // var result = {}
  // if (apps) {
  //   Object.keys(apps).forEach( function (id) {
  //     result[id] =
  //       { name: dummyNoSql[reg + ':app:' + id + ':name'] }
  //   })
  // }
  // process.nextTick( function () { cb( null, result ) } )
}

exports.appDetails = function ( reg, admin, id, cb ) {
  getKeyObj( reg, id, function ( e, keys ) {
    if (e) return cb( e )
    if (!keys) return cb( new Error('INVALID_APP_ID') )
    db.hgetall( reg + ':app:' + id, function ( e, results ) {
      if (e) return cb( e )
      if (!results) return cb( new Error('INVALID_APP_ID') )
        results.anytime = (results.anytime == 'true') // convert from string to boolean
      db.hgetall( reg + ':app:' + id + ':admins', function ( e, admins ) {
        if (e) return cb( e )
        if (!admins) return cb( new Error('UNKNOWN_ERROR') )
        results.admins = admins
        results.keys = keys
        cb( null, results )
      })
    })
  })
//   if (!dummyNoSql[reg + ':admin:' + admin + ':apps'][id]) {
//     var e = new Error('Admin is not authorative for '+id)
//     e.code = "ACCESS_DENIED"
//     process.nextTick( function () { cb( e ) } )
//   }
//   getKeyObj( reg, id, function ( e, keys ) {
//     if (e) return cb( e )
//     var result =
//       { name: dummyNoSql[reg + ':app:' + id + ':name']
//       , admins: dummyNoSql[reg + ':app:' + id + ':admins']
//       , keys: keys
//       }
//     if (reg == 'registrar')
//       result.anytime = dummyNoSql[reg + ':app:' + id + ':anytime']
//     process.nextTick( function () { cb( null, result ) } )
//   })
}


// anytime parameter is optional, and indicates if a RS
// supports anytime OAuth 2.0 access and the
// /authorizations/list & /authorization/delete APIs
exports.newApp = function ( reg, id, name, adminEmail, anytime, cb ) {
  if (typeof anytime === 'function') {
    cb = anytime
    anytime = 'NA'
  }
  db.exists( reg + ':app:' + id, function ( e, exist ) {
    if ( exist ) {
      var err = new Error('"'+ id + '" already registered')
      err.code = 'APP_ID_ALREADY_REGISTERED'
      return cb( err )
    }
    var app = { name: name }
    if ( (reg == 'registrar') && (anytime !== 'NA') ) app.anytime = anytime
    db.multi()
      .hmset( reg + ':app:' + id, app )
      .hset( reg + ':app:' + id + ':admins', adminEmail, 'ACTIVE' )
      .hset( reg + ':admin:' + adminEmail + ':apps', id, 'ACTIVE' )
      .exec( function ( e ) {
        if (e) return cb( e )
        newKeyObj( reg, id, cb )
      })
  })
  // if ( dummyNoSql[reg + ':app:' + id + ':name'] ) {
  //   var err = new Error('"'+ id + '" already registered')
  //   err.code = 'APP_ID_ALREADY_REGISTERED'
  //   return process.nextTick( function () { cb( err ) } )
  // }
  // // add to DB
  // dummyNoSql[reg + ':app:' + id + ':name'] = name
  // if ( (reg == 'registrar') && anytime)
  //   dummyNoSql[reg + ':app:' + id + ':anytime'] = true
  // dummyNoSql[reg + ':app:' + id + ':admins'] = {}
  // dummyNoSql[reg + ':app:' + id + ':admins'][adminEmail] = 'ACTIVE'
  // dummyNoSql[reg + ':admin:' + adminEmail + ':apps'] = dummyNoSql[reg + ':admin:' + adminEmail + ':apps'] || {}
  // dummyNoSql[reg + ':admin:' + adminEmail + ':apps'][id] = 'ACTIVE'
  // // gen key pair
  // newKeyObj( reg, id, function ( e, keyObj ) {
  //   cb( e, keyObj )
  // })
}

exports.checkApp = function ( reg, id, di, cb) {
  db.get( reg + ':admin:di:' + di, function ( e, adminEmail ) {
    if (e) return cb( e )
    if (!adminEmail) {
      var err = new Error('unknown administrator')
      err.code = 'UNKNOWN_USER'
      return cb( err )
    }
    db.hget( reg + ':app:' + id + ':admins', adminEmail, function ( e, state ) {
      if (e) return cb( e )
      if (!state || state != 'ACTIVE') {
        var err = new Error('Account not authorative for '+id)
        err.code = 'ACCESS_DENIED'
        return cb( err )
      }
      db.hget( reg + ':app:' + id, 'name', function ( e, name ) {
        if (e) return cb( e )
        if (!name) return cb( new Error('Could not find app:'+id ) )
        cb( null, name )
      })
    })
  })
  // var e = null
  //   , ok = null
  //   , name = null
  // var email = dummyNoSql[reg + ':admin:di:' + di]
  // if (!email) {
  //   e = new Error('unknown administrator')
  //   e.code = 'UNKNOWN_USER'
  // } else {
  //   var key = reg + ':app:' + id + ':admins'
  //   ok = ( dummyNoSql[key] && ( dummyNoSql[key][email] == 'ACTIVE' ) )
  //   if (!ok) {
  //     e = new Error('Account not authorative for '+id)
  //     e.code = 'ACCESS_DENIED'
  //   }
  // }
  // if (ok) name =  dummyNoSql[reg + ':app:' + id + ':name']
  // process.nextTick( function () { cb( e, name ) } )
}

exports.addAppAdmin = function ( reg, id, admin, cb ) {
  db.multi()
    .hset( reg + ':app:' + id + ':admins', admin, 'ACTIVE' )
    .hset( reg + ':admin:' + admin + ':apps', id, 'ACTIVE' )
    .exec( cb )
  // dummyNoSql[reg + ':app:' + id + ':admins'][admin] = 'ACTIVE'
  // dummyNoSql[reg + ':admin:' + admin + ':apps'] = dummyNoSql[reg + ':admin:' + admin + ':apps'] || {}
  // dummyNoSql[reg + ':admin:' + admin + ':apps'][id] = 'ACTIVE'
  // process.nextTick( function () { cb( null ) } )
}

exports.deleteAppAdmin = function ( reg, id, admin, cb ) {
  db.multi()
    .hdel( reg + ':app:' + id + ':admins', admin, 'ACTIVE' )
    .hdel( reg + ':admin:' + admin + ':apps', id, 'ACTIVE' )
    .exec( cb )
  // delete dummyNoSql[reg + ':app:' + id + ':admins'][admin]
  // delete dummyNoSql[reg + ':admin:' + admin + ':apps'][id]
  // process.nextTick( function () { cb( null ) } )
}

exports.deleteApp = function ( reg, id, cb ) {
  deleteKeyObj( reg, id, function ( e ) {
    if (e) return cb( e )
    db.hgetall( reg + ':app:' + id + ':admins', function ( e, admins ) {
      if (e) return cb( e )
      var multi = db.multi()
      Object.keys( admins ).forEach( function ( admin ) {
        multi.hdel( reg + ':admin:' + admin + ':apps', id )
      })
      multi.exec( cb )
    })
  })
  // delete dummyNoSql[reg + ':app:' + id + ':name']
  // deleteKeyObj( reg, id, function ( e ) {
  //   var admins = Object.keys( dummyNoSql[reg + ':app:' + id + ':admins'] )
  //   admins.forEach( function (admin) {
  //     delete dummyNoSql[reg + ':admin:' + admin + ':apps'][id]
  //   })
  //   process.nextTick( function () { cb( null ) } )
  // })
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

// console.log('\n getAnytimeAppKeys() searching:',list)

  var tasks = []
  var results = {}
  list.forEach( function ( id ) {
    tasks.push( function ( done ) {
      db.hget( 'registrar:app:' + id, 'anytime', function ( e, anytime ) {
        if (e) return done( e )

// console.log('\n getAnytimeAppKeys() anytime:"'+anytime+'"\n')

        if (anytime == "true") {
          getKeyObj( 'registrar', id, function ( e, keyObj ) {
            if (e) return done( e )
            if (!keyObj && vaultKeys) {
              keyObj = vaultKeys[id]
            }
            results[id] = keyObj
            done( null )
          })
        } else {
          done( null )
        }
      })
    })
  })
  async.parallel( tasks, function ( e ) {
    if (e) return cb( e )

// console.log('\n getAnytimeAppKeys() results\n',results)

    cb( null, results)
  })

  // var tasks = {}
  // list.forEach( function ( id ) {
  //   if (dummyNoSql['registrar:app:' + id + ':anytime']) {
  //     tasks[id] = function ( done ) {
  //       getKeyObj( 'registrar', id, function ( e, keyObj ) {
  //         if (e) return done( e )
  //         if (!keyObj && vaultKeys) {
  //           keyObj = vaultKeys[id]
  //         }
  //         done( e, keyObj )
  //       })
  //     }
  //   }
  // })
  // async.parallel( tasks, cb )
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
  var multi = db.multi()
  Object.keys( config.roles.as ).forEach( function (asHost) {
    var asDI = mapDI( asHost, ixDI )
    multi.set( 'ix:di:' + asHost + ':' + asDI, ixDI )
  })
  if (redirects) {
    Object.keys( redirects ).forEach( function (std) {
      multi.sadd( 'ix:redirect:di:' + ixDI + ':' + std, redirects[std] )
    })
  }
  multi.exec( function ( e ) {
    if (e) return cb( e )
    cb( null, dis )
  })
  // // store DI pointers
  // dummyNoSql['ix:di:' + ixDI] = {}
  // Object.keys( config.roles.as ).forEach( function (asHost) {
  //   var asDI = mapDI( asHost, ixDI )
  //   dummyNoSql['ix:di:' + asHost + ':' + asDI] = ixDI
  // })

  // // store any redirects
  // if (redirects) {
  //   Object.keys( redirects ).forEach( function (std) {
  //     dummyNoSql['ix:redirect:di:' + ixDI + ':' + std] = dummyNoSql['ix:redirect:di:' + ixDI + ':' + std] || []
  //     dummyNoSql['ix:redirect:di:' + ixDI + ':' + std].push( redirects[std] )
  //   })
  // }
  // process.nextTick( function () { cb( null, dis ) } )
}

// gets any redirected hosts stored for any standardized resources passed in
exports.getStandardResourceHosts = function ( asDI, asHost, rsList, cb ) {
  var rsStd = rsList.filter( function (rs) { return config.roles.std[rs] } )
  if (!rsStd) {
    return process.nextTick( function () { cb( null, null ) } )
  }
  db.get('ix:di:' + asHost + ':' + asDI, function ( e, ixDI ) {
    if (e) return cb( e )
    var tasks = {}
    rsStd.forEach( function ( std ) {
      tasks[std] = function( done ) { db.smembers( 'ix:redirect:di:' + ixDI + ':' + std, done ) }
    })
    async.parallel( tasks, cb )
  })
  // var ixDI = dummyNoSql['ix:di:' + asHost + ':' + asDI]
  // var redirects = {}
  // rsStd.forEach( function ( std ) {
  //   redirects[std] = dummyNoSql['ix:redirect:di:' + ixDI + ':' + std]
  // })
  // process.nextTick( function () { cb( null, redirects ) } )
}


// gets DIs for each RS from AS DI
exports.getRsDIfromAsDI = function ( asDI, asHost, rsHosts, cb ) {
  db.get( 'ix:di:' + asHost + ':' + asDI, function ( e, ixDI ) {
    if (e) return cb( e )
    var rsDI = {}
    rsHosts.forEach( function (rsHost) {
      rsDI[rsHost] = mapDI( rsHost, ixDI )
    })
    cb( null, rsDI )
  })

  // var ixDI = dummyNoSql['ix:di:' + asHost + ':' + asDI]
  // var rsDI = {}
  // rsHosts.forEach( function (rsHost) {
  //   rsDI[rsHost] = mapDI( rsHost, ixDI )
  // })
  // process.nextTick( function () { cb( null, rsDI ) } )
}

/*
* AS DB functions for Agents
*/

exports.storeAgent = function ( as, agent, cb ) {
  db.multi()
    .hmset( as + ':agent:device:' + agent.device, agent )
    .set( as + ':agent:handle:' + agent.handle, agent.device)
    .exec( cb )
  // var key = as + ':agent:device:' + agent.device
  // dummyNoSql[key] = agent
  // key = as + ':agent:handle:' + agent.handle
  // dummyNoSql[key] = agent.device
  // process.nextTick( function () { cb( null ) } )
}

// exports.retrieveAgentFromHandle = function ( as, handle, cb) {
//   var key = as + ':agent:handle:' + handle
//   var device = dummyNoSql[key]
//   key = as + ':agent:device:' + device
//   var agent = dummyNoSql[key]
//   process.nextTick( function () { cb( null, agent ) } )
// }

exports.retrieveAgentFromDevice = function ( as, device, cb) {
  db.hgetall( as + ':agent:device:' + device, cb )
  // var key = as + ':agent:device:' + device
  // var agent = dummyNoSql[key]
  // process.nextTick( function () { cb( null, agent ) } )
}

exports.deleteAgentFromHandle = function ( as, handle, cb) {
  db.get( as + ':agent:handle:' + handle, function ( e, device ) {
    if (e) return cb( e )
    if (!device) return cb( new Error('Agent handle "'+handle+'" not found') )
    db.multi()
      .del( as + ':agent:device:' + device )
      .del( as + ':agent:handle:' + handle )
      .exec( cb )
  })
  // var key = as + ':agent:handle:' + handle
  // var device = dummyNoSql[key]
  // delete dummyNoSql[key]
  // key = as + ':agent:device:' + device
  // delete dummyNoSql[key]
  // process.nextTick( function () { cb( null ) } )
}

/*
* Resource Server DB Functions
*/
exports.updateProfile = function ( rs, di, profile, cb ) {
  db.hmset( rs + ':di:' + di + ':profile', profile, cb )

//   var key = rs + ':di:' + di + ':profile'

// // console.log('\nupdateProfile from:',key)
// // console.log('profile\n',profile)


//   dummyNoSql[key] = dummyNoSql[key] || {}
//   Object.keys( profile ).forEach( function (item) {
//     dummyNoSql[key][item] = profile[item]
//   })
//   process.nextTick( function () { cb( null ) } )
}

exports.getProfile = function ( rs, di, cb ) {
  db.hgetall( rs + ':di:' + di + ':profile', function ( e, profile ) {
    if (e) return cb( e )

// console.log('db.getProfile profile:\n',profile)

    if (!profile || profile == {}) {
      var err = new Error('unknown user')
      err.code = "UNKNOWN_USER"
      return cb( err )
    }
    cb( null, profile)
  })

//   var key = rs + ':di:' + di + ':profile'

// // console.log('\ngetProfile from:',key)
// // console.log('profile\n',dummyNoSql[key])

//   if (!dummyNoSql[key]) {
//     var e = new Error('unknown user')
//     e.code = "UNKNOWN_USER"
//     process.nextTick( function () { cb( e, null ) } )
//   } else {
//     process.nextTick( function () { cb( null, dummyNoSql[key] ) } )
//   }
}

exports.deleteProfile = function ( rs, di, cb ) {
  var key = rs + ':di:' + di + ':profile'
  db.exists( key, function ( e, exists ) {

// console.log('db.deleteProfile()\ne:',e,'\nexists:',exists)

    if (!exists) {
      var err = new Error('unknown user')
      err.code = "UNKNOWN_USER"
      return cb( err )
    }
    db.del( key, cb)
  })
  //   , e = null
  // if (dummyNoSql[key]) {
  //   delete dummyNoSql[key]
  // } else {
  //   e = new Error('unknown user')
  //   e.code = "UNKNOWN_USER"
  // }
  // process.nextTick( function () { cb( e ) } )
}


exports.updateSeries = function ( rs, di, series, data, time, cb ) {
  if (time instanceof String) time = Date.parse(time)
  time = time || Date().now()
  var key = rs + ':di:' + di + ':series:' + series
  db.hset( key, time, data, cb )
  // dummyNoSql[key] = dummyNoSql[key] || {}
  // dummyNoSql[key][time] = data
  // process.nextTick( function () { cb( null ) } )
}


exports.retrieveSeries = function ( rs, di, series, cb ) {
  var key = rs + ':di:' + di + ':series:' + series
  db.hgetall( key, cb )
//  process.nextTick( function () { cb( null, dummyNoSql[key] ) } )
}

/*
* dev version of publish / subscribe
* used to move IX Token between phone and desktop
* when using QR reader
*/

// var EventEmitter = require('events').EventEmitter
// var channels = new EventEmitter()

// exports.writeChannel = function ( channel, data ) {

//   if (typeof data === 'object') {
//     data = JSON.stringify( data)
//   }
//   channels.emit( channel, data )
// }

// exports.readChannel = function ( channel, cb) {
//   channels.once( channel, function ( data ) {
//     try {
//       data = JSON.parse( data )
//     }
//     catch (e) {
//       cb( null, data )
//     }
//     cb( null, data )
//   })
// }

/*
* OAuth Access Tokens and permissions
*
*/
// create an OAuth access token
exports.oauthCreate = function ( rs, details, cb) {
  details.lastAccess = details.created = Date.now().toString()
  // need to serialize scopes
  details.scopes = JSON.stringify( details.scopes )

// console.log('oauthCreate() details\n',details)

  var accessToken = jwt.handle()
  var keyAccess = rs + ':oauth:' + accessToken
  // NOTE: an App may have multiple Access Tokens, and with different priveleges
  db.hmset( keyAccess, details, function ( e ) {
    if (e) return cb( e )
    var keyDI = rs + ':oauthGrants:' + details.sub
    db.hset( keyDI, accessToken, details.app, function ( e ) {
      if (e) return cb( e )
      cb( null, accessToken )
    })
  })
  // dummyNoSql[keyAccess] = details
  // dummyNoSql[keyAccess].created = Date.now()
  // dummyNoSql[keyAccess].lastAccess = Date.now()
  // var keyDI = rs + ':oauthGrants:' + details.sub
  // dummyNoSql[keyDI] = dummyNoSql[keyDI] || {}
  // dummyNoSql[keyDI][accessToken] = appID
  // process.nextTick( function () { cb( null, accessToken ) } )
}

// retrieve an OAuth access token, reset last access
exports.oauthRetrieve = function ( rs, accessToken, cb ) {
  var keyAccess = rs + ':oauth:' + accessToken
  db.hgetall( keyAccess, function ( e, details ) {
    if (e) return cb( e )
    if (!details) {
      var err = new Error('Invalid Access Token:'+accessToken )
      err.code = "INVALID_ACCESS_TOKEN"
      return cb( err )
    }
    try { details.scopes = JSON.parse( details.scopes ) }
    catch(e) { cb( e ) }
    db.hset( keyAccess, 'lastAccess', Date.now().toString() )
    cb( null, details )
  })

  // if ( !dummyNoSql[keyAccess] ) {
  //   var e = new Error('Invalid Access Token:'+accessToken)
  //   e.code = "INVALID_ACCESS_TOKEN"
  //   return process.nextTick( function() { cb( e ) } )
  // }
  // // we want to send current state of details so that
  // // we know last time was accessed
  // var details = JSON.parse( JSON.stringify( dummyNoSql[keyAccess] ) ) // clone object
  // dummyNoSql[keyAccess].lastAccess = Date.now()
  // process.nextTick( function () { cb( null, details ) } )
}

// list which apps have been granted OAuth access tokens
exports.oauthList = function ( rs, di, cb ) {
  var keyDI = rs + ':oauthGrants:' + di

// console.log('\n oauthList() getting grants for:', keyDI, '\n')

  db.hkeys( keyDI, function ( e, grants ) {
    if (e) return cb( e )
    if (!grants) return cb( null )
    var tasks = []
    grants.forEach( function ( accessToken ) {
      var keyAccess = rs + ':oauth:' + accessToken
      tasks.push( function( done ) {
        db.hgetall( keyAccess, function ( e, details) {
          if (e) return done( e )
          try { details.scopes = JSON.parse( details.scopes ) }
          catch(e) { cb( e ) }
          db.hget( rs + ':app:' + details.app, 'name', function ( e, name ) {
            if (e) return done( e )
              details.name = name
            done( null, details)
          })
        })
      })
    })
    async.parallel( tasks, function ( e, detailsList ) {

// console.log('\n oauthList() detailsList\n',detailsList)

      var results = {}
      detailsList.forEach( function ( details ) {
        var appID = details.app
        results[appID] = results[appID] || {}
        var lastAccess = results[appID].lastAccess || details.lastAccess
        if (lastAccess <= details.lastAccess) results[appID].lastAccess = details.lastAccess
        results[appID].name = details.name
        results[appID].resources = results[appID].resources || []
        results[appID].resources = underscore.union( results[appID].resources, details.scopes )
      })

// console.log('\n oauthList() results\n',results)

      cb( null, results )
    })
  })
  // var grants = dummyNoSql[keyDI]
  // if (!grants) return process.nextTick( function () { cb( null ) } )
  // var results = {}
  // Object.keys( grants ).forEach( function ( accessToken ) {
  //   var keyAccess = rs + ':oauth:' + accessToken
  //   var details = dummyNoSql[keyAccess]
  //   var appID = details.app
  //   results[appID] = results[appID] || {}
  //   var lastAccess = results[appID].lastAccess || details.lastAccess
  //   if (lastAccess <= details.lastAccess) results[appID].lastAccess = details.lastAccess
  //   results[appID].name = dummyNoSql[rs + ':app:' + appID + ':name']
  //   results[appID].resources = results[appID].resources || []
  //   results[appID].resources = underscore.union( results[appID].resources, details.scopes )
  // })
  // process.nextTick( function () { cb( null, results ) } )
}

// delete all OAuth access tokens granted to an app
exports.oauthDelete = function ( rs, di, appID, cb ) {
  var keyDI = rs + ':oauthGrants:' + di
  db.hgetall( keyDI, function ( e, grants ) {
    if (e) return cb( e )
    if (!grants) return cb( null )
    var multi = db.multi()
    Object.keys( grants ).forEach( function ( accessToken ) {
      if ( grants[accessToken] == appID ) {
        var keyAccess = rs + ':oauth:' + accessToken
        multi.del( keyAccess )
        multi.hdel( keyDI, accessToken )
      }
    })
    multi.exec( cb )
  })
  // var grants = dummyNoSql[keyDI]
  // Object.keys( grants ).forEach( function ( accessToken ) {
  //   if ( grants[accessToken] == appID ) {
  //     var keyAccess = rs + ':oauth:' + accessToken
  //     delete dummyNoSql[keyAccess]
  //     delete dummyNoSql[keyDI][accessToken]
  //   }
  // })
  // process.nextTick( function () { cb( null ) } )
}


// AS notification URL info

exports.createNotificationCode = function ( device, cb ) {
  var code = jwt.handle()
  var key = 'as:notification:'+code
  db.set( key, device, function ( e ) {
    if (e) return cb( null )
    cb( code )
  })
  // dummyNoSql[key] = device
  // process.nextTick( function () { cb( code ) } )
}

exports.getDeviceFromNotificationCode = function ( code, cb ) {
  var key = 'as:notification:'+code
  db.get( key, function ( e, device ) {
    if (e) return cb( null )
    cb( device )
  })
  // var device = dummyNoSql[key]
  // process.nextTick( function () { cb( device ) } )
}

// App Reporting

exports.logAgentReport = function ( token, request, appID, cb ) {
  var agentKey = 'registrar:report:agent:' + token
  var appKey = 'registrar:report:app:' + appID
  var reportsKey = 'registrar:report'
  var time = Date.now()
  db.multi()
    .hset( agentKey, time, request )
    .hset( appKey, token, time )
    .hset( reportsKey, appID, time )
    .exec( cb )

  // dummyNoSql[agentKey] = dummyNoSql[agentKey] || {}
  // dummyNoSql[agentKey][time] = request
  // dummyNoSql[appKey] = dummyNoSql[appKey] || {}
  // dummyNoSql[appKey][token] =  time
  // dummyNoSql[reportsKey] = dummyNoSql[reportsKey] || []
  // dummyNoSql[reportsKey].push( appID )
  // process.nextTick( function () { cb( null ) } )
}

exports.getReportedApps = function ( cb ) {
  var reportsKey = 'registrar:report'
  db.hgetall( reportsKey, cb )
  // var result = dummyNoSql[reportsKey]
  // process.nextTick( function () { cb( null, result) } )
}

exports.getAppReports = function ( appID, cb ) {
  var appKey = 'registrar:report:app:' + appID
  db.hgetall( appKey, cb )
  // var result = dummyNoSql[appKey]
  // process.nextTick( function () { cb( null, result) } )
}

exports.getAgentReports = function ( token, cb ) {
  var agentKey = 'registrar:report:agent:' + token
  db.hgetall( agentKey, cb )
  // var result = dummyNoSql[agentKey]
  // process.nextTick( function () { cb( null, result) } )
}

