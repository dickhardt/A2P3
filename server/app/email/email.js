/* 
* email RS Server code
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')
  , vault = require('./vault')
  , config = require('../config')
  , db = require('../db')
  , registration = require('../registration')
  , mw = require('../middleware')
  , request = require('../request')
  , token = require('../token')
  , querystring = require('querystring')
  , api = require('../api')


// /di/link API called from setup
function diLink ( req, res, next ) {
  var params = req.request['request.a2p3.org']
  db.updateProfile( 'email', params.sub, {'email': params.account}, function ( e ) {
    if (e) return next( e )
    res.send( {result: {success: true} } )
  })
}

// /email/default API called from a registered App
function emailDefault ( req, res, next ) {
  var di = req.token.sub
  db.getProfile( 'email', di, function ( e, profile ) {
    if (e) next( e )
    if (!profile || !profile.email) {
      var e = new Error('no email for user')
      e.code = 'NO_EMAIL'
      return next( e )
    }
    res.send( {result: {'email': profile.email} } )
  })
}

/*
* login code
*/

function fetchIXToken ( agentRequest, ixToken, details, cb ) {
   var apiDetails =
      { host: 'ix'
      , api: '/exchange'
      , credentials: details.vault.keys[config.host.ix].latest
      , payload: 
        { iss: config.host[details.app]
        , aud: config.host.ix
        , 'request.a2p3.org':
          { 'token': ixToken
          , 'request': agentRequest
          }
        }
      }
    api.call( apiDetails, cb )
}

// /*/login handler, generates an Agent Request and redirects to Agent
function login ( details ) {
  return function login ( req, res, next ) {
    // create Agent Request
    var agentRequestPayload =
      { iss: config.host[details.app]
      , aud: config.host.ix
      , 'request.a2p3.org':
        { 'returnURL': details.url.return 
        , 'resources': details.resources
        , 'auth': { 'passcode': true, 'authorization': true }
        }
      }
    var agentRequest = request.create( agentRequestPayload, details.vault.keys[config.host.ix].latest )  
    req.session.agentRequest = agentRequest
    var redirectUrl = details.url.agent || 'a2p3.net://token'
    redirectUrl += '?request=' + agentRequest
    res.redirect( redirectUrl )
    // TBD: what if we want a QR code??? ... want to return JSON of Agent Request and state information
  }
}

// /*/login/return handler, gets IX Token, fetches RS Tokens and redirects to success or error urls
function loginReturn ( details ) {
  return function loginReturn ( req, res, next ) {
    // check if we got IX Token
    var ixToken = req.query.token
    var errorCode = req.query.error
    var errorMessage = req.query.errorMessage

    function sendError ( code, message ) {
      var errorUrl = details.url.error + '&' + querystring.stringify( {'error':code,'errorMessage':message})
      return res.redirect( errorUrl )
    }

    // if we are doing a QR code login, then we need to get IX Token etc. over to other session

    if (!req.session.agentRequest) return sendError( "UNKNOWN", "Session information lost" )
    if (!ixToken) return sendError( errorCode, errorMessage )

    fetchIXToken( req.session.agentRequest, ixToken, details, function (response) {
      if (response.error) return sendError( response.error.code, response.error.message )
      req.session.di = response.result.sub
      req.session.tokens = response.result.tokens
      req.session.redirects = response.result.redirects
      res.redirect( details.url.success )
    })
  }
}

var loginDetails =
  { 'app': 'email'
  , 'vault': vault
  , 'resources':
    [ config.baseUrl.email + '/email/default'
    , config.baseUrl.registrar + '/scope/verify'
    ]
  , 'url':
    { 'return':   config.baseUrl.email + '/dashboard/login/return'
    , 'error':      config.baseUrl.email + '/dashboard/error'
    , 'success':    config.baseUrl.email + '/dashboard'
    }
  }




// generate request processing stack and routes
exports.app = function() {
	var app = express()

  app.use( express.limit('10kb') )  // protect against large POST attack
  app.use( express.bodyParser() )
  
  registration.routes( app, 'email', vault )  // add in routes for the registration paths

  app.get('/dashboard/login', login( loginDetails ) )

  app.get('/dashboard/login/return', loginReturn( loginDetails ) )

  app.post('/di/link' 
          , request.check( vault.keys, config.roles.enroll )
          , mw.a2p3Params( ['sub', 'account'] )
          , diLink 
          )
  app.post('/email/default' 
          , request.check( vault.keys, null, 'email' )
          , mw.a2p3Params( ['token'] )
          , token.checkRS( vault.keys, 'email', ['/scope/default'] )
          , emailDefault 
          )
  app.use( mw.errorHandler )
	
  return app
}
