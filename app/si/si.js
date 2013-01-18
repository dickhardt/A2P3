/*
* SI Server code
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')
  , underscore = require('underscore')
  , vault = require('./vault')
  , config = require('../config')
  , dashboard = require('../lib/dashboard')
  , request = require('../lib/request')
  , db = require('../lib/db')
  , mw = require('../lib/middleware')
  , token = require('../lib/token')


// /di/link API called from setup
function diLink ( req, res, next ) {
  var params = req.request['request.a2p3.org']
  db.updateProfile( 'si', params.sub, {'number': params.account}, function ( e ) {
    if (e) return next( e )
    res.send( {result: {success: true} } )
  })
}

// /number API called from a registered App
function number ( req, res, next ) {
  var di = req.token && req.token.sub
  di = di || req.oauth && req.oauth.sub
  db.getProfile( 'si', di, function ( e, profile ) {
    if (e) next( e )
    if (!profile || !profile.number) {
      var err = new Error('no social insurance number for user')
      err.code = 'NO_NUMBER'
      return next( err )
    }
    res.send( {result: {'si': profile.number} } )
  })
}


/*
* OAuth and Authorization code could be factored out and used by
* other RSes
*/


// generates an OAuth access token for later use
function oauth () {
  return function oauth ( req, res, next ) {
    var details =
      { scopes: req.token['token.a2p3.org'].scopes
      , app: req.token['token.a2p3.org'].app
      , sub: req.token.sub
      }
    db.oauthCreate( 'si', details, function ( e, accessToken ) {
      if (e) next (e)
      res.send( {result: { access_token: accessToken } } )
    })
  }
}

function _checkScope( api, scopes ) {
  if ( ( api == '/anytime/number' ) &&
      underscore.intersection( [config.baseUrl.si+'/scope/anytime/number'], scopes ) )
        return null
  return 'Invalid scope(s) for operation.'
}

// checks that caller has an authorized OAuth token
function oauthCheck () {
  return function oauthCheck ( req, res, next ) {
    var accessToken = req.body.access_token
    db.oauthRetrieve( 'si', accessToken, function ( e, details ) {
      if (e) return next( e )
      var scopeError = _checkScope( req.path, details.scopes )
      if (scopeError) {
        var err = new Error( scopeError )
        err.code = 'ACCESS_DENIED'
        return next( err )
      }
      req.oauth =
        { sub: details.sub
        }
      return next()
    })
  }
}

function _makeDeleteAuthNRequest ( rs, di, app ) {
  // impersonate Registrar calling us
  var tokenPayload =
    { 'iss': config.host.registrar
    , 'aud': config.host[rs]
    , 'sub': di
    , 'token.a2p3.org': { 'app': app }
    }
  var rsToken = token.create( tokenPayload, vault.keys[config.host.registrar].latest )
  var requestDetails =
    { 'iss': config.host.registrar
    , 'aud': config.host[rs]
    , 'request.a2p3.org': { 'app': app, 'token': rsToken }
    }
  var rsRequest = request.create( requestDetails, vault.keys[config.host.registrar].latest )
  return rsRequest
}

// list all authorizations provided by user
function listAuthN ( rs ) {
  return function listAuthN ( req, res, next ) {
    var di = req.token.sub
    db.oauthList( rs, di, function ( e, results ) {
      if (e) return next( e )
      if (!results) return res.send( { result: {} } )
      var response = results
      // make an RS Request for each App to delete it later
      Object.keys(results).forEach( function ( app ) {
        response[app].request = _makeDeleteAuthNRequest( rs, di, app )
      })
      res.send( {result: response} )
    })
  }
}

// delete all authorizations to an app for the user
function deleteAuthN ( rs ) {
  return function deleteAuthN ( req, res, next ) {
    db.oauthDelete( rs, req.token.sub, req.request['request.a2p3.org'].app, function ( e ) {
      if (e) return next( e )
      return res.send( {result:{success: true }} )
    })
  }
}


// generate request processing stack and routes
exports.app = function() {
  var app = express()

  app.use( express.limit('10kb') )  // protect against large POST attack
  app.use( express.bodyParser() )

  // All Dashboard Web pages and API
  dashboard.routes( app, 'si', vault )  // add in routes for the registration paths

  app.post('/di/link'
          , request.check( vault.keys, config.roles.enroll )
          , mw.a2p3Params( ['sub', 'account'] )
          , diLink
          )
  app.post('/number'
          , request.check( vault.keys, null, 'si' )
          , mw.a2p3Params( ['token'] )
          , token.checkRS( vault.keys, 'si', ['/scope/number'] )
          , number
          )

  app.post('/oauth'
          , request.check( vault.keys, null, 'si' )
          , mw.a2p3Params( ['token'] )
          , token.checkRS( vault.keys, 'si' )
          , oauth()
          )
  app.post('/anytime/number'  // acquire SIN at anytime
          , mw.checkParams( {'body':['access_token','series','data']} )
          , oauthCheck()
          , number
          )

  app.post('/authorizations/list' // list OAuth anytime authorizatsions
          , request.check( vault.keys, config.roles.authN, 'si' )
          , mw.a2p3Params( ['token'] )
          , token.checkRS( vault.keys, 'si' )
          , listAuthN( 'si' )
          )

  app.post('/authorization/delete' // list OAuth anytime authorizatsions
          , request.check( vault.keys, config.roles.authN, 'si' )
          , mw.a2p3Params( ['token'] )
          , token.checkRS( vault.keys, 'si' )
          , deleteAuthN( 'si' )
          )

  app.get('/documentation', mw.md( config.rootAppDir+'/si/README.md' ) )
  app.get(/\/scope[\w\/]*/, mw.trace, mw.scopes( __dirname + '/scopes.json', config.host.si ) )

  app.use( mw.errorHandler )

  return app
}
