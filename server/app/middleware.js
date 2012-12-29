/* 
* middleware.js
* 
* connect / express middleware functions 
*
* Copyright (C) Province of British Columbia, 2013
*/

exports.trace = function trace ( req, res, next ) {
  console.log('TRACE:',req.host,req.originalUrl)
  next()
}

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
exports.checkParams = function checkParams ( params ) {
  return function paramCheck( req, res, next ) {
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
exports.a2p3Params = function checkParams ( params ) {
  return function paramCheck( req, res, next ) {
    var e

debugger;

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
  express.logger.token( 'statusColor', function (req, res) { 
    if (res.statusCode != 200) {
      return '\x1b[31m'+res.statusCode+'\x1b[0m'
    } else
      return res.statusCode 
    })
  express.logger.token( 'errorCode', function (req, res) {
    if (res.errorA2P3) {
      return '\x1b[31m'+res.errorA2P3.code+'\x1b[0m'
    } else
      return '-'
    })
  express.logger.token( 'errorMessage', function (req, res) { 
    if (res.errorA2P3) {
      return '\x1b[1m'+res.errorA2P3.message+'\x1b[0m'
    } else
      return '-'
    })
  return express.logger( ':req[host]\t:method\t:url\t:statusColor\t:response-time\tms\t:errorCode\t:errorMessage' )
}