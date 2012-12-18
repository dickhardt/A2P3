/* 
* error.js
* 
* A2P3 JSON Error result code 
*
* Copyright (C) Province of British Columbia, 2013
*/

exports.errorHandler = function errorHandler (error, req, res, next) {
  error.code = error.code || 'UNKNOWN'
  console.error( 'API errorCode:', error.code, error.stack )
  res.send({'error':{'code': error.code, 'message': error.message}})
}