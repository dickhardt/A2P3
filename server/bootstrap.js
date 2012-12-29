/*
* bootstrap.js - bootstraps A2P3 environment
*
* - creates key / vault files for core hosts
* - generates a root user
* - registers all POC Apps and Resource Servers at Registrar with root user
* - registers all POC Apps at appropriate Resource Servers with root user
*
* NOTES
*   outbound email setup must be done independantly -- will associate a google hosted address with outbound
* TBD: directions on how to do this!
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

function keyPair ( hosts, a, b ) {
  hosts[a].keys[config.host[b]] = hosts[b].keys[config.host[a]] = identity.makeKeyObj()
}

keyPair( coreHostKeys, 'ix', 'as')
keyPair( coreHostKeys, 'ix', 'setup')
keyPair( coreHostKeys, 'ix', 'registrar')
keyPair( coreHostKeys, 'setup', 'registrar')
keyPair( coreHostKeys, 'setup', 'as')

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

// DI for all hosts
var diRoot
tasks.push( function (done) {
  var hosts = []
  for (var key in config.host) { hosts.push( config.host[ key ] ) }
  db.newUser( config.host.as, hosts, null, function ( e, dis ) {
    if (e) return done( e )
    diRoot = dis
    done( null, "created root user")
  })  
})

tasks.push( function (done) {
  db.registerAdmin( 'registrar', 'root', diRoot[config.host.registrar], done)
})

/*
* register each RS and build their vaults
*/
var rsHosts = ['people','health','si','email']
config.provinces.forEach( function ( province ) {
  rsHosts.push('people.'+province)
  rsHosts.push('health.'+province)
})

var rsHostKeys = {}

// we need to update the setup vault with key pairs with all RSes 
// and registrar vault with email RS, but needed DB before we could 
// register them as apps at RSes
// we get the vaults and then write them out again
var setupVault = require('./app/setup/vault') 
var registrarVault = require('./app/registrar/vault') 

// Registrar keys and registration and setup keys
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



// key exchange between each province RS and standard RS
tasks.push( function (done) {
  config.provinces.forEach( function ( province ) {
    var hostHealth = 'health.'+province
    rsHostKeys.health.keys[config.host[hostHealth]] = rsHostKeys[hostHealth].keys[config.host.health] = identity.makeKeyObj()
    var hostPeople = 'people.'+province
    rsHostKeys.people.keys[config.host[hostPeople]] = rsHostKeys[hostPeople].keys[config.host.people] = identity.makeKeyObj()
  })
  done( null, 'setup standardized resources')  
})


// register SI as app at email RS
tasks.push( function (done ) {
  db.registerAdmin( 'email', 'root', diRoot[config.host.email], function (e) { 
    if (e) done (e)
    // add root email to root DI at email RS
    db.updateProfile( 'email', diRoot[config.host.email], {'email':'root'}, function (e) {
      if (e) done (e)
      db.newApp( 'email', config.host.si, 'Social Insurance', 'root', function ( e, keyObj) {
        if (e) done (e)
        rsHostKeys.si.keys[config.host.email] = keyObj
        db.newApp( 'email', config.host.registrar, 'Registrar', 'root', function ( e, keyObj) {
          if (e) done (e)
          registrarVault.keys[config.host.email] = keyObj
          done( null, 'SI and Registrar registered at email RS')
        })
      })
    })
  })
})

// register each standardized RS as app at email RS
config.provinces.forEach( function ( province ) {
  tasks.push( function (done) {
    var hReg = 'health.' + province
    db.newApp( 'email', config.host[hReg], hReg, 'root', function ( e, keyObj) {
      if (e) done (e)
      rsHostKeys[hReg].keys[config.host.email] = keyObj
      var pReg = 'people.' + province
      db.newApp( 'email', config.host.clinic, pReg, 'root', function ( e, keyObj) {
        if (e) done (e)
        rsHostKeys[hReg].keys[config.host.email] = keyObj
        done( null, 'registered '+province+ ' for people and health at email RS')
      })
    })
  })
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

// write out updated vault file for setup and registrar
tasks.push( function (done) {
  syncWriteJSON( setupVault, __dirname + '/app/setup/vault.json')
  syncWriteJSON( registrarVault, __dirname + '/app/registrar/vault.json')
  done( null, 'wrote vault.json for setup and registrar' )
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
    db.registerAdmin( hReg, 'root', diRoot[config.host[hReg]], function (e) { // TBD -- need DI for each host
      if (e) done (e)
      db.newApp( hReg, config.host.clinic, 'Clinic', 'root', function ( e, keyObj) {
        if (e) done (e)
        appHostKeys.clinic.keys[config.host[hReg]] = keyObj
        var pReg = 'people.' + province
        db.registerAdmin( pReg, 'root', diRoot[config.host[pReg]], function (e) {
          if (e) done (e)
          db.newApp( pReg, config.host.clinic, 'Clinic', 'root', function ( e, keyObj) {
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
    db.newApp( reg, config.host.bank, 'Bank', 'root', function ( e, keyObj) {
      if (e) done (e)
      appHostKeys.bank.keys[config.host[reg]] = keyObj
      done( null, 'registered bank at '+reg)
    })
  })
})

tasks.push( function (done) {
  db.registerAdmin( 'si', 'root', diRoot[config.host.si], function (e) {
    if (e) done (e)
    db.newApp( 'si', config.host.bank, 'Bank', 'root', function ( e, keyObj) {
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


