/* 
* token.js
*
* creates and parses A2P3 tokens
*
* Copyright (C) Province of British Columbia, 2013
*/

var config = require('./config')
  , jwt = require('./jwt')

exports.create = function ( payload, credentials ) {
  var details =
    { header:
      { typ: 'JWE'
      , alg: 'dir'
      , enc: config.crypto.alg.JWE
      , kid: credentials.kid
      }
    , payload: payload
    , credentials: credentials
    }
    details.payload.iat = jwt.iat()
    return jwt.jwe( details )
}

function intersection ( a, b ) {
  return a.some( function ( aI) {
    return b.some( function (bI) { 
      return (aI === bI)
    })
  })
}

function validScope ( passedScopes, baseUrl, scopePaths ) {
  var acceptedScopes = scopePaths.map( function ( scopePath ) { return (baseUrl + scopePath); } )
  var valid = intersection( passedScopes, acceptedScopes )

  // TBD -- change to a trace??
  if (!valid) console.log('\nscopes\npassed:\t'+passedScopes+'\naccepted:\t'+acceptedScopes)

  return intersection( passedScopes, acceptedScopes )
}

// middleware that checks token is valid
// depends on request.check middleware being called prior
exports.checkRS = function ( vault, rs, scopePaths ) {
  if ( scopePaths instanceof String ) 
    scopePaths = [scopePaths]
  return (function (req, res, next) {
    var jwe, err, token
    if (!req.request['request.a2p3.org'].token) {
      err = new Error("No token in 'request.a2p3.org' payload property")
      err.code = 'INVALID_TOKEN'
      return next( err )
    }  //  
    try {
      jwe = new jwt.Parse(req.request['request.a2p3.org'].token)
      if ( !jwe.header.kid || !vault[config.host.ix][jwe.header.kid] ) {
        err = new Error("No valid key for "+config.host.ix)
        err.code = 'INVALID_TOKEN'
        return next( err )
      }
      token = jwe.decrypt( vault[config.host.ix][jwe.header.kid] )
    }
    catch (e) {
      e.code = 'INVALID_TOKEN'
      return next( e )
    }
    if ( token.iss != config.host.ix ) {
      err = new Error("RS Token must be signed by "+config.host.ix)
      err.code = 'INVALID_TOKEN'
      return next( err )
    }
    if ( token.aud != config.host[rs] ) {
      err = new Error("Wrong token audience. Should be "+config.host[rs])
      err.code = 'INVALID_TOKEN'
      return next( err )
    }
    if ( token['token.a2p3.org'].app != req.request.iss ) {
      err = new Error("Token and Request app must match")
      err.code = 'INVALID_TOKEN'
      return next( err )
    }
    if ( !validScope( token['token.a2p3.org'].scopes, config.baseUrl[rs], scopePaths ) ) {
      err = new Error("Invalid scope.")
      err.code = 'INVALID_TOKEN'
      return next( err )
    }
    if ( !token['token.a2p3.org'].auth.passcode || !token['token.a2p3.org'].auth.authorization ) {
      err = new Error("Invalid authorization. Passcode and authorization must be given.")
      err.code = 'INVALID_TOKEN'
      return next( err )
    }
    if ( jwt.expired( token.iat ) ) {
      err = new Error("The token expired.")
      err.code = 'INVALID_TOKEN'
      return next( err )
    }
    req.token = token
    next()
  })
}
