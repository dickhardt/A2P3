/* 
* api.js
*
* module for making A2P3 API calls
*
* Copyright (C) Province of British Columbia, 2013
*/

var fetchUrl = require('fetch').fetchUrl
  , config = require('./config')
  , request = require('./request')
  , querystring = require('querystring')
  , assert = require('assert')

exports.call = function ( details, callback ) {

  var baseUrl = details.host && config.baseUrl[details.host]

  assert( baseUrl, 'unknown host passed in:' + details.host )
  assert( details.api, 'no API provided' )
  assert( details.credentials, 'no credentials provided' )
  assert( details.payload, 'no payload provided' )

  var jwt = request.create( details.payload, details.credentials )

  var options =
    { method: 'POST' 
    , payload: querystring.stringify({'request': jwt})
    , headers: {'content-type': 'application/x-www-form-urlencoded'}
    }
  
// TBD: use an Error object and change callback signature to be callback( e, response )

  fetchUrl( baseUrl+details.api, options, function (error, meta, body) {
    var response = null

    if ( error || meta.status != 200 ) {
      var err = new Error(error)
      err.code = 'UNKNWON'
      return callback( err, null)
    }
    try {
      response = JSON.parse(body)
    }
    catch (e){
      e.code = 'INVALID_JSON'
      return callback( e, null)
    }
    callback( null, response.result )
  })
}