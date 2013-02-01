/*
* middleware.js
*
* connect / express middleware functions
*
* Copyright (C) Province of British Columbia, 2013
*/

// debugging middleware to trace execution

var config = require('../config')
  , fetch = require('request')  // npm request, not to be confused with local request
  , jwt = require('./jwt')
  , util = require('util')
  , db = require('./db')
  , fs = require('fs')
  , marked = require('marked')
  , time = require('time')
  , dateFormat = require('dateformat')


console.log( time.Date() )
exports.trace = function trace ( req, res, next ) {
  console.log('\nTRACE:',req.host,req.originalUrl,'\n',req.session)
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

    function dump() { // TBD make a trace of some kind??
      console.error('\ncheckParams FAILED, expected params:\n',params,'\npassed in:')

      console.error('req.query:', util.inspect( req.query, null, null ) )
      console.error('req.body:', util.inspect( req.body, null, null ) )
      console.error('req.params:', util.inspect( req.params, null, null ) )
      console.error('req.session:', util.inspect( req.session, null, null ) )
    }

    Object.keys( params ).forEach( function ( key ) {
      if (e) return
      if (!req[key]) {
        e = new Error("No "+key+" found.")
        e.code = 'INVALID_API_CALL'
        dump()
        return next( e )
      } else {
        params[key].forEach( function ( param ) {
          if (e) return
          if (!req[key][param]) {
            e = new Error("No '"+param+"' found in "+key+".")
            e.code = 'INVALID_API_CALL'
            dump()
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

time.tzset('US/Pacific')  // show time in PST
// custom logger that color codes non 200 stats codes and A2P3 errors
exports.colorLogger = function colorLogger ( express ) {

  function errorStatusCode ( code ) {
    return (code != 200 && code != 302 && code != 304)
  }


  express.logger.token( 'localTime', function (req, res) {
    return  dateFormat( time.Date(), "isoDateTime" )
    })

  express.logger.token( 'wideHost', function (req, res) {
    var wideHost = '                         '.slice(req.host.length) + req.host
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

  return express.logger( '\x1b[2m:localTime\x1b[0m|\x1b[2m:remote-addr\x1b[0m :wideHost\t:method\t:url\t:statusColor\t:response-time\tms\t:errorCode\t:errorMessage' )
}

/*
* md() renders passed in Markdown file as HTML with /css/github.css styling
*
* Used to show README.md files that are in source to document servers
*/
function _md2html ( file ) {
 // var options = { breaks: false }
  var options = { }
  var markdown = fs.readFileSync( file, 'utf8' )
  var tokens = marked.lexer( markdown, options )
  var html = marked.parser( tokens, options )
  // add in github flavoured markdown CSS so it looks like it does on github.com
  // also add in link to root at top TBD: modify to fit into rest of theme
  html  = '<!DOCTYPE html><head><link rel="stylesheet" href="/css/github.css"></head><body>'
        + '<p><a  alt="Home" href="/">Home</a></p>'
        + html
        + '</body></html>'
  return html
}

exports.md = function ( file, dontCache ) {
  var cache = !dontCache
  if (cache) { // we will cache the HTML and then save in cache
    // parse and cache HTML
    try {
      cache = _md2html( file )
    }
    catch (e) {
      return function( req, res, next) { next( e ) }
    }
  }
  return function markdown ( req, res, next ) {
    var html
    if (cache) {
      html = cache
    } else {
      try {
        html = _md2html( file )
      }
      catch (e) {
        next( e )
      }
    }
    res.send( html )
  }
}

/*
* scopes() reads in a scopes.json file and serves out scope responses inserting the host
*
* serves the scope responses
*/
exports.scopes = function scopes ( fname, rs ) {
  var rawResources = require( fname )
  var resources = {}
  Object.keys( rawResources ).forEach( function ( r ) {
    resources[r] = {}
    Object.keys( rawResources[r] ).forEach( function ( language ) {
      resources[r][language] = rawResources[r][language].replace( '%host', rs )
    })
  })
  delete rawResources
  return function ( req, res, next ) {
    if (req.path === '/scopes')  // special case to get all scopes
      return res.send( resources )
    if (!resources[req.path]) {
      var e = new Error( 'Uknown scope "'+ req.path +'"' )
      e.code = 'UNKNOWN_SCOPE'
      return next( e )
    }
    return res.send( resources[req.path] )
  }
}

/*
*   keyCheck()
*
*   used during development and deployment to check that servers have matching keys
*/
exports.keyCheck = function ( vault, client ) {
  return function keyCheck( req, res, next ) {

    var request = req.body.request
    var aud = req.body.host
    var pass = ( aud && (req.body.pass == 'makeitso') )
    var e = null
    if ( request ) {

      try {
        var jws = new jwt.Parse( request )

// console.log('\tiss:'+jws.payload.iss+'->'+jws.payload.aud)

        var issuer = jws.payload.iss
        db.getAppKey( config.reverseHost[ client ], issuer, vault.keys, function ( e, key ) {
          if (e) return next( e )
          if ( !key )
            return next( new Error('No key found for "'+issuer+'"') )
          if ( key.latest.kid != jws.header.kid )
            return next( new Error('Unknown KID "'+jws.header.kid+'", expected "'+key.latest.kid+'"') )
          try {
            if ( jws.verify( key.latest.key ) )
              return res.send( { result: { success: true } } )
            else
              return next( new Error('Signature was invalid.') )
          }
          catch ( e ) {
            return next( e )
          }
        })
      }
      catch (e) {
        e.code = "INVALID_REQUEST"
        return next( e )
      }
    } else if ( pass ) { // we are going to check our key with another server

// console.log(client+'->'+config.host[aud])

      db.getAppKey( config.reverseHost[ client ], config.host[aud], vault.keys, function ( e, key ) {
        if (e) return next( e )
        if ( !key ) return next( new Error( 'No key found for '+config.host[aud] ) )
        var jwsDetails =
          { header:
            { typ: 'JWS'
            , alg: config.crypto.alg.JWS
            , kid: key.latest.kid
            }
          , payload:
            { iss: client
            , aud: config.host[aud]
            }
          , credentials: key.latest
          }
        var jwsOut = jwt.jws( jwsDetails )
        // send jws to other host
        var options =
          { url: config.baseUrl[ aud ] + '/key/check'
          , form: { request: jwsOut }
          , method: 'POST'
          }
        fetch( options, function ( e, response, body ) {
          if ( e ) return next( e )
          if ( response.statusCode != 200 ) return (new Error( '"'+aud+'" returned '+response.statusCode) )
          return res.send( body )
        })
      })
    } else {
      e = new Error('No valid pass or request provided')
      e.code = 'ACCESS_DENIED'
      next(e)
    }
  }
}


