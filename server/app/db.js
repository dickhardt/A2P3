/* 
* Database layer
*
* Copyright (C) Province of British Columbia, 2013
*/

exports.validAgent = function ( token, callback ) {
  // stub for now
  process.nextTick( function () { callback( (token == 'testToken' ? 'Test App' : undefined) ) } )
}

