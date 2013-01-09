/*
* api.js
*
* module for making A2P3 API calls
*
* Copyright (C) Province of British Columbia, 2013
*/

var fetch = require('request')
  , config = require('./config')
  , db = require('./db')
  , request = require('./request')
  , querystring = require('querystring')
  , assert = require('assert')

exports.call = function ( details, callback ) {

// details.host only works if we already know the host
// this likely will need to be reworked :(

  var err
    , baseUrl = details.host && config.baseUrl[details.host]

  assert( baseUrl, 'unknown host passed in:' + details.host )
  assert( details.api, 'no API provided' )
  assert( details.credentials, 'no credentials provided' )
  assert( details.payload, 'no payload provided' )

  var jwt = request.create( details.payload, details.credentials )

  fetch.post( baseUrl+details.api, { form:{ 'request':jwt } }, function (error, response, body) {
    var data = null

    if ( error ) {
      err = new Error(error)
      err.code = 'UNKNWON'
      return callback( err, null)
    }
    if ( response.statusCode != 200 ) {
      err = new Error('Server responded with '+response.statusCode)
      err.code = 'UNKNWON'
      return callback( err, null)
    }
    try {
      data = JSON.parse(body)
    }
    catch (e){
      e.code = 'INVALID_JSON'
      return callback( e, null)
    }
    if (data.error) {
      var apiError = new Error(data.error.message + data.error.stack)
      apiError.code = data.error.code
      callback( apiError, null)
    }
    callback( null, data.result )
  })
}

exports.Standard = function ( vault, clientHost ) {
  this.vault = vault
  this.client = clientHost
  return this
}

exports.Standard.prototype.call = function ( host, api, params ) {
  var payload =
        { iss: config.host[this.client]
        , aud: config.host[host]
        , 'request.12p3.org': params
        }
    , credentials = db.getAppKey( this.client, config.host[host], this.vault.keys ).latest
    , path = config.baseUrl[ host ] + api
    , jwt = request.create( payload, credentials )

  fetch.post( path, { form:{ 'request':jwt } }, function (error, response, body, callback ) {
    var data = null
      , err = null

    if ( error ) {
      err = new Error(error)
      err.code = 'UNKNWON'
      return callback( err, null)
    }
    if ( response.statusCode != 200 ) {
      err = new Error('Server responded with '+response.statusCode)
      err.code = 'UNKNWON'
      return callback( err, null)
    }
    try {
      data = JSON.parse(body)
    }
    catch (e){
      e.code = 'INVALID_JSON'
      return callback( e, null)
    }
    if (data.error) {
      var apiError = new Error(data.error.message + data.error.stack)
      apiError.code = data.error.code
      callback( apiError, null)
    }
    callback( null, data.result )
  })
}

