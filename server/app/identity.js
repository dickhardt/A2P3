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
exports.createDI = function () {
    return (b64url.encode(crypto.randomBytes( config.crypto.bytesDI )))
}

// maps an IX DI to the directed id fo a host
exports.mapDI = function ( host, ixDI ) {
  var input = vault.keys[config.host.registrar].latest.key + host + ixDI
  var hash = crypto.createHash( 'sha1' )
  hash.update( input )
  var di = b64url.encode( hash.digest() )
  return di
}

exports.makeKey = function () {
  var result = {}
  result.key = b64url.safe( crypto.randomBytes( config.crypto.bytesKey ).toString('base64') )
  result.kid = b64url.safe( crypto.randomBytes( config.crypto.bytesKid ).toString('base64') )
  return result
}

exports.makeSecret = function () {
  return b64url.safe( crypto.randomBytes( config.crypto.bytesSecret ).toString('base64') )  
}