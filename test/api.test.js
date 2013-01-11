/*
* api.test.js
*
* API test suite
*
* Copyright (C) Province of British Columbia, 2013
*/
// Mocha globals to expect
/*global describe:true, it:true */

/*

enroll dev user
enroll test user
create CLI agent for both and store
enroll agent at AS
login Registrar, use dashboard, create an app
login and register app at email, si, health, people
login and check dashboard at health.bc and people.bc
acquire oauth token and store weight data at health.bc
retrieve data from all RS
list apps with long term RS access
delete authorization for long term RS
attempt access for long term data at health.bc
report app

*/

var config = require('../app/config')

// can't test with Facebook enabled, need to be in Dev mode
if (config.facebook.appId) {
  config.facebook.appId = null
  config.facebook.appSecret = null
}

var should = require('chai').should()
  , fetch = require('../app/requestJar').fetch
  , cookieJar = require('../app/requestJar').cookieJar
  , request = require('../app/request')
  , querystring = require('querystring')
  , url = require('url')
  , api = require('../app/api')
  , jwt = require('../app/jwt')
  , util = require('util')
  , urlParse = require('url').parse

var devUser =
    { label: 'Dev'
    , email: 'dev@example.com'
    }
  , testUser =
    { lable: 'Test'
    , email: 'user@example.com'
    }
  , demoApp =
    { host: 'demo.example.com'
    }
  , vault = {}

function createUser ( user ) {
  describe('Setup ' + user.label + ' User Enroll', function () {
    describe('/dev/login', function () {
      it('should redirect to /enroll and set a session cookie', function (done) {
        var options =
          { url: config.baseUrl.setup + '/dev/login'
          , form: { email: user.email }
          , method: 'POST'
          }
        fetch( options, function ( e, response ) {
          should.not.exist( e )
          should.exist( response )
          response.statusCode.should.equal( 302 )
          response.headers.should.exist
          response.headers.location.should.exist
          response.headers['set-cookie'].should.exist
          response.headers.location.should.equal('/enroll')
          done( null )
        })
      })
    })

    var profile = {}
    describe('/enroll/profile', function () {
      it('should return Test User profile', function (done) {
        var options =
          { url: config.baseUrl.setup + '/enroll/profile'
          , method: 'POST'
          , followRedirect: false
          }
        fetch( options, function ( e, response, body ) {
          should.not.exist( e )
          should.exist( response )
          response.statusCode.should.equal( 200 )
          should.exist( body )
          profile = JSON.parse( body )
          profile.should.exist
          profile.email.should.exist
          profile.email.should.equal( user.email )
          done( null )
        })
      })
    })

    describe('/enroll/register', function () {
      it('should return redirect to /dashboard ', function (done) {
        var options =
          { url: config.baseUrl.setup + '/enroll/register'
          , method: 'POST'
          , form: profile
          , followRedirect: false
          }
        fetch( options, function ( e, response ) {
          should.not.exist( e )
          should.exist( response )
          response.statusCode.should.equal( 302 )
          response.headers.should.exist
          response.headers.location.should.exist
          response.headers.location.should.equal('/dashboard')
          done( null )
        })
      })
    })

    describe('/dashboard', function () {
      it('should return an 200 status and HTML', function (done) {
        var options =
          { url: config.baseUrl.setup + '/dashboard'
          , method: 'GET'
          }
        fetch( options, function ( e, response, body ) {
          should.not.exist( e )
          should.exist( response )
          response.statusCode.should.equal( 200 )
          should.exist( body )
          done( null )
        })
      })
    })

    describe('/dashboard/agent/list', function () {
      it('should return an empty list', function (done) {
        var options =
          { url: config.baseUrl.setup + '/dashboard/agent/list'
          , method: 'POST'
          }
        fetch( options, function ( e, response, body ) {
          should.not.exist( e )
          should.exist( response )
          response.statusCode.should.equal( 200 )
          should.exist( body )
          var r = JSON.parse( body )
          should.exist( r )
          r.should.have.property('result')
          r.result.should.have.property('handles', null)
          done( null )
        })
      })
    })

    describe('/dashboard/agent/create', function () {
      it('should return an empty list', function (done) {
        var options =
          { url: config.baseUrl.setup + '/dashboard/agent/create'
          , form: { name: 'CLI' }
          , method: 'POST'
          }
        fetch( options, function ( e, response, body ) {
          should.not.exist( e )
          should.exist( response )
          response.statusCode.should.equal( 200 )
          should.exist( body )
          var r = JSON.parse( body )
          should.exist( r )
          r.should.have.property('result')
          r.result.should.have.property('device')
          r.result.should.have.property('token')
          // save CLI Agent Details for later
          user.agent = r.result
          done( null )
        })
      })
    })

  })
}

createUser( devUser )
createUser( testUser )

describe('Enrolling agent at AS', function () {
  var agentRequest = null
    , ixToken = null



  describe('AS /dev/login', function () {
    it('should generate an Agent Request and redirect to Setup', function (done) {
      var options =
        { url: config.baseUrl.as + '/setup/request'
        , method: 'GET'
        , followRedirect: false
        }
      fetch( options, function ( e, response ) {
        should.not.exist( e )
        should.exist( response )
        response.statusCode.should.equal( 302 )
        response.headers.should.exist
        response.headers.location.should.exist
        var redirect = urlParse( response.headers.location, true )
        redirect.query.should.have.property('request')
        // save Agent Request for next call
        agentRequest = redirect.query.request
        redirect.should.have.property('hostname', config.host.setup )
        redirect.should.have.property('pathname', '/dashboard/agent/token' )
        done( null )
      })
    })
  })


  describe('Setup /dashboard/agent/token', function () {
    it('should generate an IX Token and redirect back to AS', function (done) {
      var options =
        { url: config.baseUrl.setup + '/dashboard/agent/token'
        , qs: { request: agentRequest }
        , method: 'GET'
        , followRedirect: false
        }
      fetch( options, function ( e, response ) {
        should.not.exist( e )
        should.exist( response )
        response.statusCode.should.equal( 302 )
        response.headers.should.exist
        response.headers.location.should.exist
      var redirect = urlParse( response.headers.location, true )
      redirect.query.should.have.property('token')
      // save IX Token for next call
      ixToken = redirect.query.token
      redirect.should.have.property('hostname', config.host.as )
      redirect.should.have.property('pathname', '/register/login' )
      done( null )
      })
    })
  })

  describe('AS /register/login', function () {
    it('should confirm valid IX Token and redirect to /register', function (done) {
      var options =
        { url: config.baseUrl.as + '/register/login'
        , method: 'GET'
        , qs: { token: ixToken }
        , followRedirect: false
        }
      fetch( options, function ( e, response ) {
        should.not.exist( e )
        should.exist( response )
        response.statusCode.should.equal( 302 )
        response.headers.should.exist
        response.headers.should.have.property( 'location', '/register')
        done( null )
      })
    })
  })

  describe('AS /register', function () {
    it('should return status code of 200 and HTML', function (done) {
      var options =
        { url: config.baseUrl.as + '/register'
        , method: 'GET'
        , followRedirect: false
        }
      fetch( options, function ( e, response, body ) {
        should.not.exist( e )
        should.exist( response )
        should.exist( body )
        response.statusCode.should.equal( 200 )
        done( null )
      })
    })
  })

  var passcode = '1234'
    , code = null

  describe('AS /register/agent/code', function () {
    it('should generate a code to register an agent', function (done) {
      var options =
        { url: config.baseUrl.as + '/register/agent/code'
        , form: { passcode: passcode }
        , method: 'POST'
        }
      fetch( options, function ( e, response, body ) {
        should.not.exist( e )
        should.exist( response )
        response.statusCode.should.equal( 200 )
        should.exist( body )
        var r = JSON.parse( body )
        should.exist( r )
        r.should.have.property('result')
        r.result.should.have.property('code')
        // save code for next step
        code = r.result.code
        done( null )
      })
    })
  })

  // save cookie as we are pretending to be the mobile device sending the code
  var asCookie = cookieJar[config.baseUrl.as]
  cookieJar[config.baseUrl.as] = {}
  // parameters for creating Personal Agent
  var nameAgent = 'My Test Phone'
    , device = jwt.handle()
    , token = null

  describe('AS /register/agent', function () {
    it('should return a handle for the agent', function (done) {
      var options =
        { url: config.baseUrl.as + '/register/agent'
        , form: { passcode: passcode, name: nameAgent, device: device, code: code }
        , method: 'POST'
        }
      fetch( options, function ( e, response, body ) {
        should.not.exist( e )
        should.exist( response )
        response.statusCode.should.equal( 200 )
        should.exist( body )
        var r = JSON.parse( body )
        should.exist( r )
        r.should.have.property('result')
        r.result.should.have.property('token')
        // save code for next step
        token = r.result.token
        done( null )
      })
    })
  })

  cookieJar[config.baseUrl.as] = asCookie

})


// console.log('\n =>options\n', options)

// console.log('response\n', util.inspect( response, null, 1 ) ) // 'content-type': 'text/html; charset=UTF-8',

// console.log('\n =>r\n',r)


//console.log('\nredirect\n', util.inspect( redirect, null, null ) )
// console.log('cookieJar 2\n', util.inspect( cookieJar, null, null ) )


