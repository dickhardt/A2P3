/* 
* middleware.js
* 
* connect / express middleware functions 
*
* Copyright (C) Province of British Columbia, 2013
*/

exports.errorHandler = function errorHandler ( error, req, res, next ) {
  if (!error.code) {
    error.code = "UNKNOWN"
    console.error(error.stack)
    res.send({'error':{'code': error.code, 'message': error.message, 'stack': error.stack}})
  } else {
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