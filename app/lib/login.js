/*
* login.js
*
* generic connect / express middleware router for logging into sites
*
* Copyright (C) Province of British Columbia, 2013
*/


var express = require('express')
  , config = require('../config')
  , request = require('./request')
  , api = require('./api')
  , jwt = require('./jwt')
  , querystring = require('querystring')
  , util = require('util')
  , db = require('./db')
  , mw = require('./middleware')

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


// console.log('\nvault.keys\n',details.vault.keys)
// console.log('\nconfig.host:\n',config.host)
// console.log('\nconfig.baseUrl\n',config.baseUrl)

    var agentRequest = request.create( agentRequestPayload, details.vault.keys[config.host.ix].latest )
    req.session.agentRequest = agentRequest
    var jws = jwt.Parse( agentRequest )
    req.session.iat = jws.payload.iat  // tokens expire then, so we want to expire the user session by logging out
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
      if (error) return sendError( error.code, error.message )
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


function logout ( req, res ) {
  req.session = null
  res.redirect( '/' )
}

// web app API to check which user is logged in
function loginCheck ( req, res ) {
  var expiresIn = req.session.iat + config.maxTokenAge - 60 - jwt.iat() // logout a minute before it expires
  if (!req.session || !req.session.di) {
    return res.send( { error: {'code': 'NO_USER_LOGGED_IN' } } )
  }
  return res.send( { result: {'user': req.session.email, 'expiresIn': expiresIn } } )
}

// sets up all the login / out routes
exports.router = function ( app, detailsOrig ) {

  // clone object as we are going to muck with it
  var details = JSON.parse(JSON.stringify(detailsOrig))

    details.path =
      { 'login':      '/login'          // page loaded to initate login
      , 'logout':     '/logout'         // page called to logout
      , 'response':   '/login/response' // page where we redirect to
      , 'error':      '/error'          // HTML to be provided where we send user when an error
      , 'complete':   '/complete'       // HTML to be provided to show on mobile after success
      , 'loginCheck': '/login/check'    // API called to see which, if any user is logged in
      }

  if (details.dashboard) { // setup standard dashboard settings, dashboard is name of host
    details.host = config.host[details.dashboard]
    details.baseUrl = config.baseUrl[details.dashboard]
    details.resources =
      [ config.baseUrl.email + '/scope/default'
      , config.baseUrl.registrar + '/scope/verify'
      ]
    details.path.success = '/dashboard'                // HTML to be provided on success

  }


  // create URLs to use
  details.url = {}
  Object.keys( details.path ).forEach ( function ( p ) {
    details.url[p] = details.baseUrl + details.path[p]
  })

// console.log('\nDetails\n',details)

  // setup session management

  app.use( express.cookieParser() )
  var cookieOptions = { 'secret': details.vault.secret, 'cookie': { path: '/' } }
  app.use( express.cookieSession( cookieOptions ))

  app.get( details.path.login, login( details ) )
  app.get( details.path.logout, logout )
  app.get( details.path.response, loginStateCheck( details ), loginReturn( details ) )
  app.get( details.path.loginCheck, loginStateCheck( details ), loginCheck )

  app.get( details.path.error, function( req, res ) { res.sendfile( config.rootAppDir + '/html/login_error.html' ) } )
  app.get( details.path.complete, function( req, res ) { res.sendfile( config.rootAppDir + '/html/login_complete.html' ) } )

  // key integrity checking API
  app.post( '/key/check', mw.keyCheck( details.vault, details.host ) )
}


