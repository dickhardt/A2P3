/*
* CLI Agent module
*
* module used for testing, does work of agent
*
* Copyright (C) Province of British Columbia, 2013
*/

var fetch = require('request')
  , jwt = require('./jwt')
  , config = require('../config')

var Create = function ( options ) {
  options = options || {}
  this.error = null
  this.host = options.host || config.baseUrl.setup
  options = options || {}
  this.device = options.device
  this.token = options.token
  this.ready = this.device && this.token && true
  return this
}

// return an IX Token for passed Agent Request
Create.prototype.ixToken = function ( agentRequest , cb ) {
  if (!this.ready) return cb( null )
  var jws = jwt.Parse( agentRequest )
  var options =
    { url: config.baseUrl.setup + '/token'
    , method: 'POST'
    , json:
      { device: this.device
      , sar: jws.signature
      , auth:
        { passcode: true  // not needed for CLI agents
        , authorization: true
        }
      }
    }
  fetch( options, function ( e, response, json ) {
    if (e) return cb( e )
    var ixToken = json.result.token
    cb( null, ixToken )
  })
}

// list all apps with long term resource access
// passed a list of resource servers
// TBD Q: remember which resource servers we have been called with
Create.prototype.listAuthorizations = function ( list , cb ) {
  if (!this.ready) return cb( null )
  // call Registrar and then each returned RS

// XXXXX add code here, then add tests!!! :)

// registrar /authorizations/requests

// TBD: need to filter out requests to only provide ones that support /authorizations/list API

// RS /authorizations/list

}

// revoke long term resource access for app
// handle was obtained from listAuthorizations
Create.prototype.deleteAuthorization = function ( handle , cb ) {
  if (!this.ready) return cb( null )

}

// report an app for abuse
Create.prototype.report = function ( agentRequest , cb ) {
  if (!this.ready) return cb( null )

}

// calls Setup to register a User and generate a CLI Agent
Create.prototype.generate = function ( options, cb ) {
/* Process:
    override any defaults with options
    setup /dev/login
    setup /enroll/register
    setup /dashboard/agent/create
*/
  var that = this

  if (typeof options === 'function') {
    cb = options
    options = {}
  }
  options = options || {}


  var setup = options.host || that.host
    , agentName = options.agent || 'CLI Agent'
    , email = options.email || config.testUser.email
    , profile = config.testUser

  Object.keys( profile ).forEach( function ( item ) {
    profile[item] = options[item] || profile[item]
  })

// setup complete, invocation starts at bottom

  // wrapper to catch errors when done
  function done ( error ) {
    if (error) {
      that.error = error
    }
    if ( cb ) cb( error )
  }

  function complete ( error, response, body ) {
    if (error) return done( error )
    try {
      var response = JSON.parse( body )
    }
    catch (e) {
      return done( e )
    }
    if ( response.error ) return done ( response.error )
    that.device = response.result.device
    that.token = response.result.token
    that.ready = that.device && that.token && true
    done( null )
  }

  function dashboardAgentCreate ( error, response, body ) {
    if (error) return done( error )
    var options =
      { url: setup +'/dashboard/agent/create'
      , form: { name: agentName }
      , method: 'POST'
      }
    fetch( options, complete )
  }

  function enrollRegister ( error, response, body ) {
    if (error) return done( error )
    if (response.headers.location == '/dashboard') {
      // we are already registered, skip enrollment
      return dashboardAgentCreate( error, response, body )
    }
    if (response.headers.location != '/enroll') {
      var err = new Error('Did not get redirected as expected')
      return done( err )
    }
    var options =
      { url: setup +'/enroll/register'
      , form: profile
      , method: 'POST'
      }
    fetch( options, dashboardAgentCreate )
  }

  var options =
    { url: setup +'/dev/login'
    , form: { email: email }
    , method: 'POST'
    }
  fetch( options, enrollRegister )

} // generateAgent


exports.Create = Create
