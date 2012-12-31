/* 
* middleware.js
* 
* connect / express middleware functions 
*
* Copyright (C) Province of British Columbia, 2013
*/

// debugging middleware to trace execution

var config = require('./config')
  , request = require('./request')
  , api = require('./api')
  , jwt = require('./jwt')
  , querystring = require('querystring')
  , db = require('./db')

exports.trace = function trace ( req, res, next ) {
  console.log('TRACE:',req.host,req.originalUrl)
  next()
}

// note the four parameters which indicates this is an error handler
exports.errorHandler = function errorHandler ( error, req, res, next ) {
  if (!error.code) {
    error.code = "UNKNOWN"
    console.error(error.stack)
    res.send({'error':{'code': error.code, 'message': error.message, 'stack': error.stack}})
  } else {

    console.error(error.stack)

    res.errorA2P3 = error // logger uses this to log A2P3 error info
    res.send({'error':{'code': error.code, 'message': error.message}})
  }
}

// will check to ensure the expected paramaters are present
exports.checkParams = function  ( params ) {
  return function checkParams( req, res, next ) {
    var e
    Object.keys( params ).forEach( function ( key ) {
      if (e) return
      if (!req[key]) { 
        e = new Error("No "+key+" found.")
        e.code = 'INVALID_API_CALL'
        return next( e )
      } else {
        params[key].forEach( function ( param ) {
          if (e) return
          if (!req[key][param]) { 
            e = new Error("No '"+param+"' found in "+key+".")
            e.code = 'INVALID_API_CALL'
            return next( e )
          }
        } )
      }
    } )
    if (!e) return next()
  }
}

// check if expected a2p3 paramaters are present
exports.a2p3Params = function ( params ) {
  return function a2p3Params( req, res, next ) {
    var e

    if (!req.request || !req.request['request.a2p3.org']) { 
      e = new Error("request.a2p3.org not found in request")
      e.code = 'INVALID_API_CALL'
      return next( e )
    }
    params.forEach( function ( param ) {
      if (e) return
      if (!req.request['request.a2p3.org'][param]) { 
        e = new Error("request.a2p3.org parameter '"+param+"' not found")
        e.code = 'INVALID_API_CALL'
        return next( e )
      }
    } )
    if (!e) return next()
  }
}

// custom logger that color codes non 200 stats codes and A2P3 errors
exports.colorLogger = function colorLogger ( express ) {

  function errorStatusCode ( code ) {
    return (code != 200 && code != 302)
  }

  express.logger.token( 'wideHost', function (req, res) {
    var wideHost = '                              '.slice(req.host.length) + req.host
    return ( errorStatusCode( res.statusCode ) ) 
      ? '\x1b[31m'+wideHost+'\x1b[0m'
      : wideHost
    })

  express.logger.token( 'statusColor', function (req, res) {
    return ( errorStatusCode( res.statusCode ) ) 
      ? '\x1b[31m'+res.statusCode+'\x1b[0m' 
      : res.statusCode 
    })

  express.logger.token( 'errorCode', function (req, res) {
    return (res.errorA2P3)
      ? '\x1b[31m'+res.errorA2P3.code+'\x1b[0m'
      : '-'
    })

  express.logger.token( 'errorMessage', function (req, res) { 
    return (res.errorA2P3)
      ? '\x1b[1m'+res.errorA2P3.message+'\x1b[0m'
      : '-'
    })

  return express.logger( ':wideHost\t:method\t:url\t:statusColor\t:response-time\tms\t:errorCode\t:errorMessage' )
}

/*
* login middleware
*
* general middleware for logging into a site and getting resource tokens
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

// /*/login handler, generates an Agent Request 
// returns to caller if 'qr' parameter provided
// redirects to 'returnURL' if provided
// else redirects to Agent Protocol Handler
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
    var jsonResponse = req.query && req.query.json
    var agentRequest = request.create( agentRequestPayload, details.vault.keys[config.host.ix].latest )  
    req.session.agentRequest = agentRequest
    var redirectUrl = (req.query && req.query.returnURL) ? req.query.returnURL : 'a2p3.net://token'
    redirectUrl += '?request=' + agentRequest
    if (jsonResponse) {  // client wants JSON, likely will generate QR code
      var state = jwt.handle()
      req.session.loginState = state
      var statusURL = details.url.return + '?' + querystring.stringify( { 'state': state } )
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
      var errorUrl = details.url.error + '&' + querystring.stringify( {'error':code,'errorMessage':message})
      return res.redirect( errorUrl )
    }
    if (!req.session.agentRequest) return sendError( "UNKNOWN", "Session information lost" )
    if (!ixToken) return sendError( errorCode, errorMessage )

    fetchIXToken( req.session.agentRequest, ixToken, details, function (response) {
      if (response.error) return sendError( response.error.code, response.error.message )
      req.session.di = response.result.sub
      req.session.tokens = response.result.tokens
      req.session.redirects = response.result.redirects
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

/*

Sample details object

var details =
  { 'app': 'email'  // app
  , 'vault': vault  // vault for app
  , 'resources':    // array of resources wanted by app
    [ config.baseUrl.email + '/email/default'
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
  }

*/

exports.loginHandler = function ( app, detailsOrig ) {

  // clone object as we are going to muck with it
  var details = JSON.parse(JSON.stringify(detailsOrig))

  if (details.dashboard) { // setup standard dashboard settigns
    details.baseUrl = config.baseUrl[details.app]
    details.resources = 
      [ config.baseUrl.email + '/email/default'
      , config.baseUrl.registrar + '/scope/verify'
      ]
    details.path =
      { 'login':      '/dashboard/login'
      , 'return':     '/dashboard/login/return'
      , 'error':      '/dashboard/error'
      , 'success':    '/dashboard'
      , 'complete':   '/dashboard/complete'  
      }
  }
  // create URLs to use
  details.url = {}
  Object.keys( details.path ).forEach ( function ( p ) {
    details.url[p] = details.baseUrl + details.path[p] 
  })

  app.get( details.path.login, login( details ) )

  app.get( details.path.return, loginStateCheck( details ), loginReturn( details ) )

}
