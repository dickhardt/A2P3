/* 
* middleware.js
* 
* connect / express middleware functions 
*
* Copyright (C) Province of British Columbia, 2013
*/

// debugging middleware to trace execution
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