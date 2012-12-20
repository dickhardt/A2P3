/* 
* Directed Identifier functions
*
* Copyright (C) Province of British Columbia, 2013
*/

var crypto = require('crypto')
 , b64url = require('./b64url')
 , vault = require('./ix/vault')
 , config = require('./config')

// generates a  directed id
exports.create = function () {
    return (b64url.encode(crypto.randomBytes(20)))
}

// maps an IX DI to the directed id fo a host
exports.map = function ( host, ixDI ) {
  var input = vault.keys[config.host.registrar] + host + ixDI
  var hash = crypto.createHash( 'sha1' )
  hash.update( input )
  var di = b64url.encode( hash.digest() )
}