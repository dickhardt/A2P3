/*
* IX Server code
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')
  , url = require('url')
  , util = require('util')
  , vault = require('./vault')
  , config = require('../config')
  , request = require('../lib/request')
  , token = require('../lib/token')
  , db = require('../lib/db')
  , api = require('../lib/api')
  , jwt = require('../lib/jwt')
  , mw = require('../lib/middleware')

function diCreate ( req, res, next ) {
    var AS = req.request['request.a2p3.org'].AS
    var rsHosts = req.request['request.a2p3.org'].RS
    var redirects = req.request['request.a2p3.org'].redirects
    db.newUser( AS, rsHosts, redirects, function ( e, dis ) {
      if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
      res.send( {'result': {'dis': dis}} )
    })
}


// parses out hosts from passed in scopes
function getHosts ( scopes ) {
  var results = {}
  if (scopes)
    scopes.forEach( function ( scope ) {
      var o = url.parse( scope )
      results[o.hostname] = results[o.hostname] || []
      results[o.hostname].push( scope )
    })
  return results
}


// exchange IX Token for RS Tokens if all is good
function exchange ( req, res, next ) {
  var jwe, jws, ixToken, e
  try {
    jwe = new jwt.Parse( req.request['request.a2p3.org'].token )
    if (jwe.header.typ === 'JWS') {
      e = new Error( 'Received a JWS when expecting a JWE')
      e.code = "INVALID_TOKEN"
      return next( e )
    }
    if (jwe.header.typ !== 'JWE') {
      e = new Error( 'Uknown token type.')
      e.code = "INVALID_TOKEN"
      return next( e )
    }
    if ( !jwe.header.kid || !vault.keys.as[jwe.header.kid] ) {
      e = new Error( "No AS key for 'kid' "+jwe.header.kid)
      e.code = "INVALID_TOKEN"
      return next( e )
    }
    ixToken = jwe.decrypt( vault.keys.as[jwe.header.kid] ) // list of keys for AS
  }
  catch (e) {
    e.code = 'INVALID_TOKEN'
    return next( e )
  }
  try {
    jws = new jwt.Parse( req.request['request.a2p3.org'].request )  // agent Request
    if ( !jwt ) {
      e = new Error( "Invalid Agent Request")
      e.code = "INVALID_REQUEST"
      return next( e )
    }
  }
  catch (e) {
    e.code = 'INVALID_REQUEST'
    return next( e )
  }

  // make sure IX Token 'iss' matches associated 'kid'
  if (!vault.keys[ixToken.iss][jwe.header.kid]) {
      e = new Error("'iss' does not have supplied 'kid'")
      e.code = 'INVALID_TOKEN'
      return next( e )
  }
  // check agent request signature matches 'sar' that AS got
  if (ixToken['token.a2p3.org'].sar != jws.signature) {
      e = new Error("IX Token 'sar' does not match request signature")
      e.code = 'INVALID_IXREQUEST'
      return next( e )
  }
  // check ix request and agent request are from same app
  if (req.request.iss != jws.payload.iss) {
      e = new Error("Agent Request 'iss' does not match IX Request 'iss'")
      e.code = 'INVALID_REQUEST'
      return next( e )
  }
  // check IX & Agent Requests and IX Token have not expired
  if ( jwt.expired( req.request.iat ) ) {
      e = new Error("IX Request has expired")
      e.code = 'EXPIRED_IXREQUEST'
      return next( e )
  }
  if ( jwt.expired( jws.payload.iat ) ) {
      e = new Error("Agent Request has expired")
      e.code = 'EXPIRED_REQUEST'
      return next( e )
  }
  if ( jwt.expired( jwe.payload.iat ) ) {
      e = new Error("IX Token has expired")
      e.code = 'EXPIRED_TOKEN'
      return next( e )
  }

// console.log('\njwe\n', util.inspect( jwe, null, null ) )
// console.log('\njws\n', util.inspect( jws, null, null ) )

  var rsScopes = getHosts( jws.payload['request.a2p3.org'].resources )
  db.getStandardResourceHosts( ixToken.sub, ixToken.iss, Object.keys( rsScopes ), function ( e, redirects ) {
    var hostList = {}
    hostList[jws.payload.iss] = true
    Object.keys(rsScopes).forEach( function (rs) {
      if (redirects && redirects[rs]) {
        redirects[rs].forEach( function (host) {
          hostList[host] = true
          rsScopes[host] = rsScopes[rs] // redirected host has scope of standardized resource
        })
      } else {
        hostList[rs] = true
      }
    })

// console.log('\nhostList\n',hostList)

    // app keys for IX are stored with registrar
    db.getAppKeys( 'registrar', Object.keys(hostList), vault.keys, function ( e, keys ) {
      if (e) return next( e )
        var err
      if ( !keys[jws.payload.iss] || !keys[jws.payload.iss][jws.header.kid] ) {
        err = new Error( "Invalid Agent Request key or kid")
        err.code = "INVALID_REQUEST"
        return next( err )
      }
      if ( !jws.verify( keys[jws.payload.iss][jws.header.kid] ) ) {
        err = new Error( "Invalid Agent Request")
        err.code = "INVALID_REQUEST"
        return next( err )
      }
      db.getRsDIfromAsDI( ixToken.sub, ixToken.iss, Object.keys(hostList), function ( e, dis ) {
        if (e) return next( e )
        // make tokens for all resources, delete caller from list
        var tokens = {}
        delete hostList[jws.payload.iss]
        Object.keys( hostList ).forEach( function (rs) {
          var payload =
            { 'iss': config.host.ix
            , 'aud': rs
            , 'sub': dis[rs]
            , 'token.a2p3.org':
              { 'auth': jwe.payload['token.a2p3.org'].auth
              , 'app': jws.payload.iss
              , 'scopes': rsScopes[rs]
              }
            }
          tokens[rs] = token.create( payload, keys[rs].latest )
        })
        return res.send( { result: {'sub': dis[jws.payload.iss], 'tokens': tokens, 'redirects': redirects} } )
      })
    })
  })
}


// APIs called from AS agent registration web app
function agentList ( req, res, next ) {
    db.listAgents(  req.request['request.a2p3.org'].di
                  , req.request.iss
                  , function( e, handles ) {
                      if (e) return next (e)
                      return res.send({ result: { 'handles': handles } } )
                    } )
}

function agentAdd ( req, res, next ) {
    db.addAgent( req.request['request.a2p3.org'].di
                  , req.request.iss
                  , req.request['request.a2p3.org'].name
                  , function( e, token, handle ) {
                      if (e) return next (e)
                      return res.send({ result: { token: token, handle: handle } } )
                    } )
}

function agentDelete ( req, res, next ) {
  var di = req.request['request.a2p3.org'].di
    , as = req.request.iss
    , handle = req.request['request.a2p3.org'].handle
    db.deleteAgent( di, as, handle, function( e, AS ) {
      var details =
        { host: config.reverseHost[AS]  // hack because of how api.call works currently TBD :(
        , api: '/agent/delete'
        , credentials: vault.keys[AS].latest
        , payload:
          { iss: config.host.ix
          , aud: AS
          , 'request.a2p3.org': { 'handle': handle }
          }
        }
      api.call( details, function ( e ) {
        if (e) return next (e)
        return res.send( { result: { success: true } } )
    })
  })
}

exports.app = function() {
	var app = express()
  app.use(express.limit('10kb'))  // protect against large POST attack
  app.use(express.bodyParser())

  app.post('/di/create'
          , request.check( vault.keys, config.roles.enroll )
          , mw.a2p3Params( ['AS', 'RS', 'redirects'] )
          , diCreate
          )
  app.post('/exchange'
          , request.check( vault.keys, null, 'registrar' )  // registrar holds all IX App keys
          , mw.a2p3Params( ['token', 'request'] )
          , exchange
          )
  app.post('/agent/list'
          , request.check( vault.keys, config.roles.as )
          , agentList
          )
  app.post('/agent/add'
          , request.check( vault.keys, config.roles.as )
          , agentAdd
          )
  app.post('/agent/delete'
          , request.check( vault.keys, config.roles.as )
          , agentDelete
          )

  // show README.md as documentation
  app.get('/documentation', mw.md( __dirname+'/README.md' ) )

  // key integrity checking API
  app.post( '/key/check', mw.keyCheck( vault, config.host.ix ) )

  app.use( mw.errorHandler )

	return app
}
