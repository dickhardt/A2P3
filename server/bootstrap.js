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

var b64url = require('./app/b64url')
  , crypto = require('crypto')
  , fs = require('fs')
  , util = require('util')
  , config = require('./app/config')
  , identity = require('./app/identity')

 
function syncWriteJSON ( obj, fname ) {
  var data = JSON.stringify( obj )
  fs.writeFileSync( fname, data )
}


// create keys for core hosts
var coreHosts =
  { 'ix': {'keys':{}, 'secret': identity.makeSecret()}
  , 'registrar': {'keys':{}, 'secret': identity.makeSecret()}
  , 'as': {'keys':{}, 'secret': identity.makeSecret()}
  , 'setup': {'keys':{}, 'secret': identity.makeSecret()}
  }

function keyPair ( a, b ) {
  var kk = identity.makeKey()
  coreHosts[a].keys[config.host[b]] = coreHosts[b].keys[config.host[a]] = {latest: kk}
  coreHosts[a].keys[config.host[b]][kk.kid] = coreHosts[b].keys[config.host[a]][kk.kid] = kk.key
}

keyPair( 'ix', 'as')
keyPair( 'ix', 'setup')
keyPair( 'ix', 'registrar')
keyPair( 'setup', 'registrar')

// setup AS keychain for IX
coreHosts.ix.keys.as = {}
coreHosts.ix.keys.as[coreHosts.ix.keys[config.host.as].latest.kid] = coreHosts.ix.keys[config.host.as].latest.key
coreHosts.ix.keys.as[coreHosts.ix.keys[config.host.setup].latest.kid] = coreHosts.ix.keys[config.host.setup].latest.key


Object.keys( coreHosts ).forEach( function (host) {
  coreHosts[host].private = identity.makeKey()
  syncWriteJSON( coreHosts[host], 'app/'+host+'/vault.json' ) 
} )

// NOTE: we cannot load db until registrar keys have been created or it will fail to load
var db = require('./app/db')          

var diRootAS, diRootRegistrar

db.newUser( config.host.as, [config.host.registrar], function ( e, dis ) {
  if (e) return e
  diRootAS = dis[config.host.as]
  diRootRegistrar = dis[config.host.registrar]
})

db.registerAdmin( 'root', diRootRegistrar, function ( e ) {

})

//  get list of apps, register them all
// add key pair for standardized resources

/*

    db.newRegistrarApp( app.host, app.name, 'root', function ( e, kk ) {
      xxx [config.host.registrar] = { latest: kk}
      [config.host.registrar][kk.kid] = kk.key
    })
*/

process.exit(0)

