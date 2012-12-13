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
  
  fetchUrl( baseUrl+'/di/create', options, function (error, meta, body) {
    var response
    if ( !error && meta.status == 200 ) {
      try {
        response = JSON.parse(body)
      }
      catch (e){
        response = {'error': {code: 'INVALID_JSON', 'e':e}}
      }
    } else {
      if (error) {
        response = error
      } else {
        response =  {'error': {'code': meta.status}}
      }
    }
    callback( response )
  })
}