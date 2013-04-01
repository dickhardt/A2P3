/*
* CLI Agent module
*
* module used for testing, does work of agent
*
* Copyright (C) Province of British Columbia, 2013
*/

var fetch = require('request')
  , async = require('async')
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
  if (!this.ready) return cb( new Error('Agent is not ready.') )
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
  if (!this.ready) return cb( new Error('Agent is not ready.') )
  // call Registrar and then each returned RS

  var options =
    { url: config.baseUrl.registrar + '/authorizations/requests'
    , method: 'POST'
    , json:
      { authorizations: list
      , token: this.token
      }
    }
  fetch( options, function ( e, response, json ) {
    if ( e ) return cb( e )
    if (response.statusCode != 200 ) return cb( new Error( response.statusCode ) )
    var rsRequests = json.result
    var tasks = {}
    Object.keys( rsRequests ).forEach( function ( rs ) {
      tasks[rs] = function ( done ) {
        var options =
          { url: config.baseUrl[config.reverseHost[rs]] + '/authorizations/list'
          , method: 'POST'
          , form: { request: rsRequests[rs] }
          }
        fetch( options, function ( e, response, body ) {
          if (e) return done( e )
          if (response.statusCode != 200 ) return cb( new Error( response.statusCode ) )
          var json = JSON.parse( body )
          done( null, json.result )
        })
      }
    })
    async.parallel( tasks, function ( e, results) {
      var response = {}
      Object.keys( results ).forEach( function ( rs ) {
        Object.keys( results[rs] ).forEach( function ( app ) {
          response[app] = response[app] || {}
          response[app][rs] =
            { resources: results[rs][app].resources
            , request: results[rs][app].request
            , lastAccess: results[rs][app].lastAccess
            }
          response[app].name = results[rs][app].name
        })
      })
      cb( e, response )
    })
  })
}

// revoke long term resource access for app
// request was obtained from listAuthorizations
Create.prototype.deleteAuthorization = function ( rs, request , cb ) {
  if (!this.ready) return cb( new Error('Agent is not ready.') )
  var options =
    { url: config.baseUrl[config.reverseHost[rs]] + '/authorization/delete'
    , method: 'POST'
    , form: { request: request }
    }
  fetch( options, function ( e, response, body ) {
    if (e) return cb( e )
    if (response.statusCode != 200 ) return cb( new Error( response.statusCode ) )
    var json = JSON.parse( body )
    cb( null, json.result )
  })
}

// report an app for abuse
Create.prototype.report = function ( agentRequest , cb ) {
  if (!this.ready) return cb( new Error('Agent is not ready.') )

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
