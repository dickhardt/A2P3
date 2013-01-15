/*
* login.js
*
* generic connect / express middleware router for logging into sites
*
* Copyright (C) Province of British Columbia, 2013
*/


var config = require('../config')
  , request = require('./request')
  , api = require('./api')
  , jwt = require('./jwt')
  , querystring = require('querystring')
  , util = require('util')
  , db = require('./db')

function fetchIXToken ( agentRequest, ixToken, details, cb ) {
   var apiDetails =
      { host: 'ix'
      , api: '/exchange'
      , credentials: details.vault.keys[config.host.ix].latest
      , payload:
        { iss: details.host
        , aud: config.host.ix
        , 'request.a2p3.org':
          { 'token': ixToken
          , 'request': agentRequest
          }
        }
      }
    api.call( apiDetails, cb )
}

// /*/login handler, generates an Agent Request
// returns to caller if 'qr' parameter provided
// redirects to 'returnURL' if provided
// else redirects to Agent Protocol Handler
function login ( details ) {
  return function login ( req, res, next ) {
    // create Agent Request
    var agentRequestPayload =
      { iss: details.host
      , aud: config.host.ix
      , 'request.a2p3.org':
        { 'returnURL': details.url.response
        , 'resources': details.resources
        , 'auth': { 'passcode': true, 'authorization': true }
        }
      }

// console.log('\n login req.session:\n', req.session )
// console.log('\n login req.body:\n', req.body )
// console.log('\n login req.query:\n', req.query )

    var agentRequest = request.create( agentRequestPayload, details.vault.keys[config.host.ix].latest )
    req.session.agentRequest = agentRequest
    var redirectUrl = (req.query && req.query.returnURL) ? req.query.returnURL : 'a2p3.net://token'
    redirectUrl += '?request=' + agentRequest
    if (req.query && req.query.json) {  // client wants JSON, likely will generate QR code
      var state = jwt.handle()
      req.session.loginState = state
      var statusURL = details.url.response + '?' + querystring.stringify( { 'state': state } )
      redirectUrl += '&' + querystring.stringify( { 'statusURL': statusURL, 'state': state } )
      return res.send( { result: {'request': redirectUrl } } )
    } else {
      return res.redirect( redirectUrl )
    }
  }
}

// /*/login/return handler
// if gets IX Token, fetches RS Tokens and redirects to success or error urls
function loginReturn ( details ) {
  return function loginReturn ( req, res, next ) {
    // check if we got IX Token
    var ixToken = req.query.token
    var errorCode = req.query.error
    var errorMessage = req.query.errorMessage

    function sendError ( code, message ) {
      if (req.query && req.query.json) {
        var e = new Error( message )
        e.code = code
        return next( e )
      } else {
        var errorUrl = details.url.error + '?' + querystring.stringify( {'error':code,'errorMessage':message})
        return res.redirect( errorUrl )
      }
    }

    if (!req.session.agentRequest) return sendError( "UNKNOWN", "Session information lost" )
    if (!ixToken) return sendError( errorCode, errorMessage )

    fetchIXToken( req.session.agentRequest, ixToken, details, function ( error, result ) {
      if (error) return sendError( result.error.code, result.error.message )
      req.session.di = result.sub
      req.session.tokens = result.tokens
      req.session.redirects = result.redirects
      var jsonResponse = req.query && req.query.json
      if (jsonResponse) {  // client wants JSON
        return res.send( { result: {'url': details.url.success } } )
      } else {
        res.redirect( details.url.success )
      }
    })
  }
}
function loginStateCheck ( details ) {
  return function loginStateCheck ( req, res, next ) {
    if (!req.query.state) return next()
    // we have a loginState, which means we have moved the Agent Request
    // and IX Token using a different browser

    if (req.query.token || req.query.error) { // we are getting token or error from the agent, publish to channel
      // var channelData = JSON.stringify( req.query )
      db.writeChannel( req.query.state, req.query )
      res.redirect( details.url.complete )
      return // next('route')
    } else {
      if (req.query.state != req.session.loginState) {
        var e = new Error('Could not find state in session data')
        e.code = 'UNKNOWN_ERROR'
        return next(e)
      }
      db.readChannel( req.query.state, function ( e, query ) {
        if (e) return next( e )
        Object.keys(query).forEach( function (k) { req.query[k] = query[k] } )
        next()
      })
    }
  }
}

/* in case we need this ... otherwise, delete TBD
exports.checkLoggedIn = function ( req, res, next ) {
  if (!req.session || !req.session.di) {
    var e = new Error('not logged in')
    e.code = 'ACCESS_DENIED'
    return next(e)
  }
  next()
}
*/

function loginCheck ( req, res, next ) {
  if (!req.session || !req.session.di) {
    var e = new Error('not logged in')
    e.code = 'ACCESS_DENIED'
    return next(e)
  }
  return res.send( { result: {'user': req.session.email } } )
}

/*

Sample details object for loginHandler

var details =
  { 'host': config.host.email  // app host
  , 'vault': vault  // vault for app
  , 'resources':    // array of resources wanted by app
    [ config.baseUrl.email + '/scope/default'
    , config.baseUrl.registrar + '/scope/verify'
    ]
  , 'path':          // paths were each step of login goes
        // these paths are managed here
    { 'login':      '/dashboard/login'
    , 'return':     '/dashboard/login/return'
        // these are static pages that should map to somewhere TBD, generic?
    , 'error':      '/dashboard/error'
    , 'success':    '/dashboard'
    , 'complete':   '/dashboard/complete'
    }
  , dashboard: 'email'  // if present, sets up default config for dashboards
  }

*/


exports.router = function ( app, detailsOrig ) {

  // clone object as we are going to muck with it
  var details = JSON.parse(JSON.stringify(detailsOrig))

  if (details.dashboard) { // setup standard dashboard settings
    details.host = config.host[details.dashboard]
    details.baseUrl = config.baseUrl[details.dashboard]
    details.resources =
      [ config.baseUrl.email + '/scope/default'
      , config.baseUrl.registrar + '/scope/verify'
      ]
    details.path =
      { 'login':      '/dashboard/login'          // page loaded to initate login
      , 'response':   '/dashboard/login/response' // page where we redirect to
      , 'error':      '/dashboard/error'          // HTML to be provided where we send user when an error
      , 'success':    '/dashboard'                // HTML to be provided on success
      , 'complete':   '/dashboard/complete'       // HTML to be provided to show on mobile after success
      , 'loginCheck': '/dashboard/login/check'    // API called to see which, if any user is logged in
      }
  }
  // create URLs to use
  details.url = {}
  Object.keys( details.path ).forEach ( function ( p ) {
    details.url[p] = details.baseUrl + details.path[p]
  })

  app.get( details.path.login, login( details ) )

  app.get( details.path.response, loginStateCheck( details ), loginReturn( details ) )

  app.get( details.path.loginCheck, loginStateCheck( details ), loginCheck )

}


