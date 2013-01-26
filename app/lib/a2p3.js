/*
* A2P3 App Module
*
* library to make it easy to build A2P3 apps with node.js
*
* Copyright (C) Province of British Columbia, 2013
*/

var request = require('request')
  , urlParse = require('url').parse
  , jwt = require('./jwt')
  , fs = require('fs')
  , async = require('async')

var vault = null
  , config = null

function init( c, v ) {
  config = c
  vault = v
  // makes sure config and vault have what we need, sets defaults not provided
  if (!config) throw new Error('Invalid config')
  if (!config.appID) throw new Error('No appID in config')
  if (!config.device) throw new Error('No device in config')
  if (!config.name) throw new Error('No name in config')
  if (!vault) throw new Error('Invalid vault')
  config.ix = config.ix || 'ix.a2p3.net'
  config.ixURL = config.ixURL || 'http://ix.a2p3.net'
  if (!vault[config.ix] || !vault[config.ix].latest) throw new Error('No keys for IX in vault.')
  config.alg = config.alg || 'HS512'
  config.auth = config.auth || { passcode: true, authorization: true }
}

// create an Agent Request
function createAgentRequest ( returnURL, resources ) {
  if (!vault || !config) throw new Error('a2p3 needs to be initialized with init( config, vault) ')
  var credentials = vault[ config.ix ].latest
  var details =
  { header:
    { typ: 'JWS'
    , alg: config.alg
    }
  , payload:
    { 'iss': config.appID
    , 'aud': config.ix
    , 'iat': jwt.iat()
    , 'request.a2p3.org':
      { 'resources': resources
      , 'auth': config.auth
      , 'returnURL': returnURL
      }
    }
  , credentials: credentials
  }
  this.agentRequest = jwt.jws( details )
  return this.agentRequest
}

// Resource constructor
function Resource ( ) {
  if (!vault || !config) throw new Error('a2p3 needs to be initialized with init( config, vault) ')
  return this
}


function processResponse ( callback ) {
  return function processResponse ( error, response, body ) {
    var data = null
      , err = null
    if ( error ) {
      err = new Error(error)
      return callback( err, null)
    }
    if ( response.statusCode != 200 ) {
      err = new Error('Server responded with '+response.statusCode)
      return callback( err, null)
    }
    try {
      data = JSON.parse(body)
    }
    catch (e){
      return callback( e, null)
    }
    if (data.error) {
      err = new Error(data.error.message)
      return callback( err, null)
    }
    callback( null, data.result )
  }
}

// Exchange the IX Token for the RS Tokens
Resource.prototype.exchange = function exchange ( agentRequest, ixToken, callback ) {
  var that = this
    , credentials = vault[config.ix].latest
    , details =
      { header:
        { typ: 'JWS'
        , alg: config.alg
        }
      , payload:
        { 'iss': config.appID
        , 'aud': config.ix
        , 'iat': jwt.iat()
        , 'request.a2p3.org':
          { 'token': ixToken
          , 'request': agentRequest
          }
        }
      , credentials: credentials
      }
  var ixRequest = jwt.jws( details )
  request.post( config.ixURL + '/exchange'
    , { form: { request: ixRequest } }
    , processResponse( function ( e, result ) {
        if (e) return callback( e )
        that.ix = result              // store results in this.ix for later
        callback( null, that.ix.sub )
      })
    )
}

// call a Resource API
Resource.prototype.call = function call ( api, params, callback ) {
  if (typeof params === 'function') {
    callback = params
    params = {}
  }
  var that = this
    , url = urlParse( api )
    , apiHost = url.hostname
    , err = null
  if ( !that.ix ) {
    err = new Error('No IX exchange results in A2P3 Resource object.')
    return callback( err )
  }
  // check if we are calling a standardized resource, and if so, map to the first redirect
  if ( that.ix.redirects && that.ix.redirects[ apiHost ] ) {
    var newApiHost = that.ix.redirects[ apiHost ][ 0 ]
    api = api.replace( apiHost, newApiHost )
    apiHost = newApiHost
    }
  if ( !that.ix.tokens || !that.ix.tokens[ apiHost] ) {
    err = new Error('No Resource Server token found in A2P3 Resource object for "'+apiHost+'".')
    return callback( err )
  }
  if ( !vault[ apiHost ] || !vault[ apiHost ].latest ) {
    err = new Error('No keys found in vault for "'+apiHost+'".')
    return callback( err )
  }
  var credentials = vault[ apiHost ].latest
  var details =
  { header:
    { typ: 'JWS'
    , alg: config.alg
    }
  , payload:
    { 'iss': config.appID
    , 'aud': apiHost
    , 'iat': jwt.iat()
    , 'request.a2p3.org': params || {}
    }
  , credentials: credentials
  }
  details.payload['request.a2p3.org'].token = that.ix.tokens[ apiHost ]
  var rsRequest = jwt.jws( details )
  request.post( api, { form: { request: rsRequest } } , processResponse( callback ) )
}




// calls mulitple Resource APIs and all Standardized Resource redirected resources
Resource.prototype.callMultiple = function callMultiple ( apis, callback ) {
  var that = this
    , err = null

  if ( !that.ix ) {
    err = new Error('No IX exchange results in A2P3 Resource object.')
    return callback( err )
  }

  var tasks = {}
  var redirectResults = {}
  Object.keys( apis ).forEach( function ( api ) {
    var url = urlParse( api )
      , apiHost = url.hostname
    // check if we are calling a standardized resource, and if so, call each redirected resource
    if ( that.ix.redirects && that.ix.redirects[ apiHost ] ) {
      that.ix.redirects[ apiHost ].forEach( function ( host ) {
        var redirectApi = api.replace( apiHost, host )
        tasks[host] = function( done ) { that.call( redirectApi, apis[api], done ) }
      })
      redirectResults[apiHost] = { redirects: that.ix.redirects[ apiHost ] }
    } else {
      tasks[apiHost] = function( done ) { that.call( api, apis[api], done ) }
    }
  })
  async.parallel( tasks, function ( error, results ) {
    if ( results )
      Object.keys( redirectResults ).forEach( function ( redirect ) {
        results[redirect] = redirectResults[redirect]
      })
    callback( error, results )
  })
}


exports.init = init
exports.Resource = Resource
exports.createAgentRequest = createAgentRequest

exports.random16bytes = function() {
  return jwt.handle()
}



