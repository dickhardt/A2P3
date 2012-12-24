/*
* bootstrap.js - bootstraps A2P3 environment
*
* - creates key / vault files for core hosts
* - generates a root user
* - registers all POC Apps and Resource Servers at Registrar with root user
* - registers all POC Apps at appropriate Resource Servers with root user
* - does snapshot of all data files
*
* NOTES
*   outbound email setup must be done independantly -- will associate a google address with outbound
*
*/

var fs = require('fs')
  , crypto = require('crypto')
  , util = require('util')
  , async = require('async')
  , b64url = require('./app/b64url')
  , config = require('./app/config')
  , identity = require('./app/identity')

 
function syncWriteJSON ( obj, fname ) {
  var data = JSON.stringify( obj )
  fs.writeFileSync( fname, data )
}


// create keys for core hosts
var coreHostKeys =
  { 'ix': {'keys':{}, 'secret': identity.makeSecret()}
  , 'registrar': {'keys':{}, 'secret': identity.makeSecret()}
  , 'as': {'keys':{}, 'secret': identity.makeSecret()}
  , 'setup': {'keys':{}, 'secret': identity.makeSecret()}
  }

function keyPair ( a, b ) {
  var kk = identity.makeKey()
  coreHostKeys[a].keys[config.host[b]] = coreHostKeys[b].keys[config.host[a]] = {latest: kk}
  coreHostKeys[a].keys[config.host[b]][kk.kid] = coreHostKeys[b].keys[config.host[a]][kk.kid] = kk.key
}

keyPair( 'ix', 'as')
keyPair( 'ix', 'setup')
keyPair( 'ix', 'registrar')
keyPair( 'setup', 'registrar')

// setup AS keychain for IX
coreHostKeys.ix.keys.as = {}
coreHostKeys.ix.keys.as[coreHostKeys.ix.keys[config.host.as].latest.kid] = coreHostKeys.ix.keys[config.host.as].latest.key
coreHostKeys.ix.keys.as[coreHostKeys.ix.keys[config.host.setup].latest.kid] = coreHostKeys.ix.keys[config.host.setup].latest.key

//  write out vault.json files for coreHostKeys
Object.keys( coreHostKeys ).forEach( function (host) {
  coreHostKeys[host].private = identity.makeKey()
  syncWriteJSON( coreHostKeys[host], 'app/'+host+'/vault.json' ) 
} )


// NOTE: we cannot load db until registrar keys have been created or it will fail to load
var db = require('./app/db')          

// the rest of our bootstrap calls are not syncronous, so we create
// an array of tasks and then execute them in order
var tasks = []

// globals for App and RS registration
var diRootAS, diRootRegistrar

tasks.push( function (done) {
  db.newUser( config.host.as, [config.host.registrar], function ( e, dis ) {
    if (e) return done( e )
    diRootAS = dis[config.host.as]
    diRootRegistrar = dis[config.host.registrar]
    done( null, "created root user")
  })  
})

tasks.push( function (done) {
  db.registerAdmin( 'registrar', 'root', diRootRegistrar, done)
})

/*
* register each RS and build their vaults
*/
var rsHosts = ['people','health','si']
config.provinces.forEach( function ( province ) {
  rsHosts.push('people.'+province)
  rsHosts.push('health.'+province)
})

var rsHostKeys = {}

var setupVault = require('./app/setup/vault') // we need to update setup vault with key pair for each RS

// Registrar keys and registration
rsHosts.forEach( function (rs) {
  rsHostKeys[rs] = {'keys':{}, 'secret': identity.makeSecret()}
  tasks.push( function (done) {
    db.newApp( 'registrar', config.host[rs], rs, 'root', function ( e, keyObj ) {
      if (e) return done( e )
      rsHostKeys[rs].keys[config.host.registrar] = rsHostKeys[rs].keys[config.host.ix] = keyObj
      // add key pair with setup
      rsHostKeys[rs].keys[config.host.setup] = setupVault.keys[config.host[rs]] = identity.makeKeyObj()
      done ( null, "registered "+rs )
    })
  })
})

// standardizes resources key exchange
tasks.push( function (done) {
  config.provinces.forEach( function ( province ) {
    var hostHealth = 'health.'+province
    rsHostKeys.health.keys[config.host[hostHealth]] = rsHostKeys[hostHealth].keys[config.host.health] = identity.makeKeyObj()
    var hostPeople = 'people.'+province
    rsHostKeys.people.keys[config.host[hostPeople]] = rsHostKeys[hostPeople].keys[config.host.people] = identity.makeKeyObj()
  })
  done( null, 'setup standardized resources')  
})

// write out vault files for each RS
tasks.push( function (done) {
  var result = []
  rsHosts.forEach( function (rs) {
    var subdir = rs.replace( '.', '/' )
    syncWriteJSON( rsHostKeys[rs], __dirname + '/app/' + subdir + '/vault.json')
    result.push( 'wrote vault.json for '+rs)
  })
  done( null, result )
})

// write out updated vault file for setup
tasks.push( function (done) {
  syncWriteJSON( setupVault, __dirname + '/app/setup/vault.json')
  done( null, 'wrote vault.json for setup' )
})

/*
* register apps at each RS
*/

var appHostKeys =
  {'clinic': { 'keys': {}, 'secret': identity.makeSecret()}
  , 'bank': { 'keys': {}, 'secret': identity.makeSecret()}
  }

// clinic app
config.provinces.forEach( function ( province ) {
  tasks.push( function (done) {
    var hReg = 'health.' + province
    db.registerAdmin( hReg, 'root', diRootRegistrar, function (e) {
      if (e) done (e)
      db.newApp( hReg, config.host.clinic, 'Clinic', root, function ( e, keyObj) {
        if (e) done (e)
        appHostKeys.clinic.keys[config.host[hReg]] = keyObj
        var pReg = 'people.' + province
        db.registerAdmin( pReg, 'root', diRootRegistrar, function (e) {
          if (e) done (e)
          db.newApp( pReg, config.host.clinic, 'Clinic', root, function ( e, keyObj) {
            if (e) done (e)
            appHostKeys.clinic.keys[config.host[pReg]] = keyObj
            done( null, 'registered clinic at '+hReg+' & '+pReg)
          })
        })
      })
    })
  })
})

tasks.push( function (done) {
  syncWriteJSON( appHostKeys.clinic, __dirname + '/app/clinic/vault.json')
  done( null, 'wrote vault.json for clinic' )
})

// bank app
config.provinces.forEach( function ( province ) {
  tasks.push( function (done) {
    var reg = 'people.' + province
    db.newApp( reg, config.host.bank, 'Bank', root, function ( e, keyObj) {
      if (e) done (e)
      appHostKeys.bank.keys[config.host[reg]] = keyObj
      done( null, 'registered bank at '+reg)
    })
  })
})

tasks.push( function (done) {
  db.registerAdmin( 'si', 'root', diRootRegistrar, function (e) {
    if (e) done (e)
    db.newApp( 'si', config.host.bank, 'Bank', root, function ( e, keyObj) {
      if (e) done (e)
      appHostKeys.bank.keys[config.host.si] = keyObj
      syncWriteJSON( appHostKeys.bank, __dirname + '/app/bank/vault.json')
      done (null, 'added bank to si RS, and wrote out vault.json for bank')
    })
  })
})

async.series( tasks, function ( err, results ) {
  console.log( results )
  if (err) {
    console.error( err )
    process.exit(1)
  } else {
    process.exit(0)
  }
})


