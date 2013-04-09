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
  , fs = require('fs')

// HTML for meta refresh and Agent Install Page
// we could read this in once, but reading it in each
// time makes it easy to edit and reload for development
var META_REFRESH_HTML_FILE = __dirname + '/.. /html/meta_refresh.html'

// calculate this once
var QR_SESSION_LENGTH = jwt.handle().length


//////////////////////////////////////////////////////////////////
//TBD - put following into a DB call
/////////////////////////////////////////////////////////////////


// Global for holding QR sessions, need to put in DB if running mulitple instances
// NOTE: DOES NOT SCALE AS CODED
// checkForTokenRequest and storeTokenRequest are coded with callbacks so that
// they can easily be implemented to store data in a DB
var sessions = {}

// checks if we are have received the IX Token and Agent Request from the Agent
function checkForTokenRequest( qrSession, callback ) {
  if ( !sessions[qrSession] ) return callback( null, null, null )
  var agentRequest = sessions[qrSession].agentRequest
  var ixToken = sessions[qrSession].ixToken
  var error = sessions[qrSession].error
  delete sessions[qrSession]
  callback( error, ixToken, agentRequest )
}

// stores IX Token and Agent Request we received back channel from the Agent
function storeTokenRequest( result, callback ) {
  var state = result.state
  sessions[state] =
    { agentRequest: result.request
    , ixToken: result.token
    , error: result.error
    }
  callback( null )
}


// metaRedirectInfoPage() returns a meta-refresh page with the supplied URL
function metaRedirectInfoPage ( redirectURL ) {
  var html = fs.readFileSync( META_REFRESH_HTML_FILE, 'utf8' )
  return html.replace( '$REDIRECT_URL', redirectURL )
}


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

// loginQR() - called by web app when it wants a QR code link
// creates an agentRequest and state
function loginQR( details ) {
  return function loginQR( req, res )  {
    var qrSession = jwt.handle()
    req.session.qrSession = qrSession
    var qrCodeURL = details.baseUrl + '/QR/' + qrSession
    res.send( { result: { qrURL: qrCodeURL, qrSession: qrSession } } )
  }
}

// QR Code was scanned
// if scanned by Agent, then 'json=true' has been set and we return the Agent Request in JSON
// if scanned by a general QR reader, then return a meta refresh page with Agent Reqeuest and
// and state parameter of qrSession so we can link the response from the Agent
// back to this web app session in checkQR
function qrCode( details ) {
  return function qrCode( req, res ) {
    var qrSession = req.params.qrSession
    // make sure we got something that looks like a qrSession
    if ( !qrSession || qrSession.length != QR_SESSION_LENGTH || qrSession.match(/[^\w-]/g) ) {
      return res.redirect('/error')
    }
    // create Agent Request
    var agentRequestPayload =
      { iss: details.host
      , aud: config.host.ix
      , 'request.a2p3.org':
        { 'callbackURL': details.baseUrl + '/login/response/callback'
        , 'resources': details.resources
        , 'auth': { 'passcode': true, 'authorization': true }
        }
      }
    var agentRequest = request.create( agentRequestPayload, details.vault.keys[config.host.ix].latest )
      , json = req.query.json
    if ( json ) {
      return res.send( { result: { agentRequest: agentRequest, state: qrSession } } )
    } else {
      var redirectURL = 'a2p3://token?request=' + agentRequest + '&state=' + qrSession
      var html =  metaRedirectInfoPage( redirectURL )
      return res.send( html )
    }
  }
}

// /*/login handler, generates an Agent Request
// returns to caller if 'qr' parameter provided
// redirects to 'returnURL' if provided
// else redirects to Agent Protocol Handler
function login ( details ) {
  return function login ( req, res ) {
    // create Agent Request
    var agentRequestPayload =
      { iss: details.host
      , aud: config.host.ix
      , 'request.a2p3.org':
        { 'returnURL': details.baseUrl + '/login/response/redirect'
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
    if (req.query && req.query.json) {  // client wants JSON,
      var state = jwt.handle()
      req.session.loginState = state
      var statusURL = details.baseUrl + '/login/response/redirect' + '?' + querystring.stringify( { 'state': state } )
      redirectUrl += '&' + querystring.stringify( { 'statusURL': statusURL, 'state': state } )
      return res.send( { result: {'request': redirectUrl } } )
    } else {
      return res.redirect( redirectUrl )
    }
  }
}

/*
* We are getting called back through the redirect which means we are running on the
* same device as the Agent is
*/
function loginResponseRedirect ( details ) {
  return function loginReturn ( req, res ) {
    // check if we got IX Token
    var ixToken = req.query.token
    var agentRequest = req.query.request || req.session.agentRequest
    var errorCode = req.query.error
    var errorMessage = req.query.errorMessage

    if (!agentRequest || !ixToken) return res.redirect( '/error' )

    fetchIXToken( agentRequest, ixToken, details, function ( error, result ) {
      if (error) return res.redirect( '/error' )
      req.session.di = result.sub
      req.session.tokens = result.tokens
      req.session.redirects = result.redirects
      res.redirect( details.pathSuccess )
    })
  }
}

/*
* Agent is calling us back with the IX Token and Agent Request, but
* Agent is running on a different device
*/
function loginResponseCallback ( ) {
  return function loginReturn ( req, res ) {
    var ixToken = req.body.token
    var agentRequest = req.body.request
    var qrSession = req.body.state
    var error = req.body.error
    var errorMessage = req.body.errorMessage

    if (!qrSession) {
      return res.send( { error: { code: 'MISSING_STATE', message: 'State is required' } } )
    }
    if (error || errorMessage) {
      return storeTokenRequest( req.body, function ( e ) {
        if ( e ) return res.send( { error: e } )
        return res.send( { error: { code: error, message: errorMessage } } )
      })
    }
    if (!ixToken || !agentRequest) {
      var code = 'MISSING_REQUEST'
      if (!ixToken) code = 'MISSING_TOKEN'
      return res.send( { error: { code: code, message: 'token, request and state are required' } } )
    }
    storeTokenRequest( req.body, function ( e ) {
      if ( e ) return res.send( { error: e } )
      return res.send( { result: { success: true } } )
    })
  }
}

/*
* polled by web app to see if QR code has been read yet
*/
function checkQR ( details ) {
  return function checkQR ( req, res ) {
    if (!req.body.qrSession)
      return res.send( { error: 'No QR Session provided' } )
    checkForTokenRequest( req.body.qrSession, function ( e, ixToken, agentRequest ) {
      if (e) return res.send( { error: e } )
      if (!ixToken || !agentRequest) {
        return res.send( { status: 'waiting'} )
      }
      fetchIXToken( agentRequest, ixToken, details, function ( error, result ) {
        var response = {}
        if ( error ) response.error = error
        if ( result ) {
          req.session.di = result.sub
          req.session.tokens = result.tokens
          req.session.redirects = result.redirects
          response.result = { success: true }
        }
        return res.send( response )
      })
    })
  }
}



// function loginStateCheck ( details ) {
//   return function loginStateCheck ( req, res, next ) {
//     if (!req.query.state) return next()
//     // we have a loginState, which means we have moved the Agent Request
//     // and IX Token using a different browser

//     if (req.query.token || req.query.error) { // we are getting token or error from the agent, publish to channel
//       // var channelData = JSON.stringify( req.query )
//       db.writeChannel( req.query.state, req.query )
//       res.redirect( details.url.complete )
//       return // next('route')
//     } else {
//       if (req.query.state != req.session.loginState) {
//         var e = new Error('Could not find state in session data')
//         e.code = 'UNKNOWN_ERROR'
//         return next(e)
//       }
//       db.readChannel( req.query.state, function ( e, query ) {
//         if (e) return next( e )
//         Object.keys(query).forEach( function (k) { req.query[k] = query[k] } )
//         next()
//       })
//     }
//   }
// }


function logout ( req, res ) {
  req.session = null
  res.redirect( '/' )
}

// web app API to check which user is logged in
function loginCheck ( req, res ) {

console.log('logincheck')

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

  if (details.dashboard) { // setup standard dashboard settings, dashboard is name of host
    details.host = config.host[details.dashboard]
    details.baseUrl = config.baseUrl[details.dashboard]
    details.resources =
      [ config.baseUrl.email + '/scope/default'
      , config.baseUrl.registrar + '/scope/app/list'
      ]
    details.pathSuccess = '/dashboard'                // HTML to be provided on success

  }

  // setup session management

  app.use( express.cookieParser() )
  var cookieOptions = { 'secret': details.vault.secret, 'cookie': { path: '/' } }
  app.use( express.cookieSession( cookieOptions ))

  app.get( '/login', login( details ) )
  app.get( '/logout', logout )
  app.post( '/login/check', loginCheck )
  app.post( '/login/QR', loginQR( details ) )
  app.post( '/check/QR', checkQR( details ) )
  app.get(  '/QR/:qrSession', qrCode( details ) )

  app.get( '/login/response/redirect', loginResponseRedirect( details ) )
  app.post( '/login/response/callback', loginResponseCallback( details ) )

  app.get( '/error', function( req, res ) { res.sendfile( config.rootAppDir + '/html/login_error.html' ) } )
  app.get( '/complete', function( req, res ) { res.sendfile( config.rootAppDir + '/html/login_complete.html' ) } )

  // key integrity checking API
  app.post( '/key/check', mw.keyCheck( details.vault, details.host ) )

}


