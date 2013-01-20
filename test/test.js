/*
* test.js
*
* A2P3 API test suite
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
  , querystring = require('querystring')
  , urlParse = require('url').parse
  , util = require('util')
  , fetch = require('../app/lib/requestJar').fetch
  , cookieJar = require('../app/lib/requestJar').cookieJar
  , request = require('../app/lib/request')
  , API = require('../app/lib/api')
  , jwt = require('../app/lib/jwt')
  , agent = require('../app/lib/agent')
  , vaultRegistrar = require('../app/registrar/vault')

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
    , name: 'Demo App'
    }
  , vault = { keys: {} }

var PASSCODE = '1234'

// add our demo host in so modules work properly
config.host.demo = demoApp.host

// restore Database to snapshot
function restoreDatabase( done ) {
  var api = new API.Standard( 'registrar', vaultRegistrar )
  api.call( 'setup', '/database/restore', null, done )
}

// TBD save Database to 'test' snapshot at end of run before restoring
// or should we just leave database in Test mode????


/*
* Enroll the Dev and Test users in Setup and generate a CLI agent for both
*
*/

describe('Restoring ', function () {
  describe('Database', function () {
    it('should just happen', function (done) {
      restoreDatabase( done )
    })
  })
})

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

/*
*   Enroll a Mobile Agent for Test User (last user to be at Setup) at AS
*/


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

  var passcode = PASSCODE
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
    it.skip('should fail', function (done) {
      var options =
        { url: config.baseUrl.as + '/register/agent'
        , form: { passcode: 6666, name: nameAgent, device: device, code: code }
        , method: 'POST'
        }
      fetch( options, function ( e, response, body ) {
        should.not.exist( e )
        should.exist( response )
        response.statusCode.should.equal( 200 )
        should.exist( body )
        var r = JSON.parse( body )
        should.exist( r )
        r.should.have.property('error')
        r.should.not.have.property('result')
        done( null )
      })
    })
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
    it.skip('should not return a handle for the agent the second time the code is used', function (done) {
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
        r.should.have.property('error')
        r.should.not.have.property('result')
        done( null )
      })
    })
  })
  // restore cookie as we are done being the Mobile Device
  cookieJar[config.baseUrl.as] = asCookie


  // let's make sure we have both of our agents at Setup
    describe('setup /dev/login', function () {
      it('should redirect to /dashboard and set a session cookie', function (done) {
        var options =
          { url: config.baseUrl.setup + '/dev/login'
          , form: { email: testUser.email }
          , method: 'POST'
          }
        fetch( options, function ( e, response ) {
          should.not.exist( e )
          should.exist( response )
          response.statusCode.should.equal( 302 )
          response.headers.should.exist
          response.headers.location.should.exist
          response.headers['set-cookie'].should.exist
          response.headers.location.should.equal('/dashboard')
          done( null )
        })
      })
    })

  describe('setup /dashboard/agent/list', function () {
    it('should return two handles', function (done) {
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

// console.log('\ndashboard/list\n', util.inspect( r, null, null ) )

        r.should.not.have.property('error')
        r.should.have.property('result')
        r.result.should.have.property('handles')
        Object.keys( r.result.handles).should.have.length( 2 )

        done( null )
      })
    })
  })



})

function registerDemoApp ( rs, standard ) {
  describe('Registering Demo App at '+rs, function () {
    cookieJar = {}  // clear cookieJar so we are like clean browser
    var agentRequest = null
      , ixToken = null
      , jws = null
    describe( ' /login', function () {
      it('should return an Agent Request', function ( done ) {
        var options =
          { url: config.baseUrl[rs] + '/login'
          , method: 'GET'
          , qs: { json: true }
          , followRedirect: false
          }
        fetch( options, function ( e, response, body ) {
          should.not.exist( e )
          should.exist( response )
          response.statusCode.should.equal( 200 )
          should.exist( body )
          var r = JSON.parse( body )
          should.exist( r )
          r.should.have.property('result')
          r.result.should.have.property('request')
          // save Agent Request and parse it for next call
          var agentUrl = r.result.request
          should.exist( agentUrl )
          var u = urlParse( agentUrl, true )
          should.exist( u )
          u.should.have.property('query')
          u.query.should.have.property('request')
          agentRequest = u.query.request
          jws = new jwt.Parse( agentRequest )
          should.exist( jws )
          done( null )
        })
      })
    })

    describe('-> Setup /token', function () {
      it('should return an IX Token', function (done) {
        var options =
          { url: config.baseUrl.setup + '/token'
          , method: 'POST'
          , json:
            { device: devUser.agent.device
            , sar: jws.signature
            , auth:
              { passcode: PASSCODE
              , authorization: true
              }
            }
          }
        fetch( options, function ( e, response, json ) {
          should.not.exist( e )
          should.exist( response )
          response.statusCode.should.equal( 200 )
          should.exist( json )
          json.should.have.property('result')
          json.result.should.have.property('token')
          // save code for next step
          ixToken = json.result.token
          done( null )
        })
      })
    })

    describe( ' /login/return', function () {
      it('should redirect to /dashboard', function ( done ) {
        var options =
          { url: jws.payload['request.a2p3.org'].returnURL
          , method: 'GET'
          , qs: { token: ixToken }
          , followRedirect: false
          }
        fetch( options, function ( e, response ) {
          should.not.exist( e )
          should.exist( response )
          response.statusCode.should.equal( 302 )
          response.headers.should.exist
          response.headers.should.have.property( 'location', config.baseUrl[rs] + '/dashboard')
          done( null )
        })
      })
    })

    describe(' /dashboard', function () {
      it('should return status code of 200 and HTML', function (done) {
        var options =
          { url: config.baseUrl[rs] + '/dashboard'
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

    describe(' /dashboard/new/app', function () {
      it('should return keys for the Demo app', function (done) {
        var options =
          { url: config.baseUrl[rs] + '/dashboard/new/app'
          , form: { id: demoApp.host }
          , method: 'POST'
          }
        if (rs == 'registrar') options.form.name = demoApp.name
        fetch( options, function ( e, response, body ) {
          should.not.exist( e )
          should.exist( response )
          response.statusCode.should.equal( 200 )
          should.exist( body )
          var r = JSON.parse( body )
          should.exist( r )
          r.should.have.property('result')
          if (standard) { // we are working with a standardized resource
            var hosts = Object.keys(r.result)
            hosts.should.have.length(config.provinces.length)
            hosts.forEach( function (host) {
              r.result.should.have.property(host)
              r.result[host].should.have.property('latest')
              r.result[host].latest.should.have.property('key')
              r.result[host].latest.should.have.property('kid')
              vault.keys[host] = r.result[host]
            })
            done( null )
          } else {
            r.result.should.have.property('key')
            r.result.key.should.have.property('latest')
            r.result.key.latest.should.have.property('key')
            r.result.key.latest.should.have.property('kid')
            // save keys for later calls
            vault.keys[config.host[rs]] = r.result.key
            if (rs == 'registrar') vault.keys[config.host.ix] = r.result.key
            done( null )
          }
        })
      })
    })

    describe(' /dashboard/list/apps', function () {
      it('should return the Demo App', function (done) {
        var options =
          { url: config.baseUrl[rs] + '/dashboard/list/apps'
          , method: 'GET'
          }
        fetch( options, function ( e, response, body ) {
          should.not.exist( e )
          should.exist( response )
          response.statusCode.should.equal( 200 )
          should.exist( body )
          var r = JSON.parse( body )
          should.exist( r )
          r.should.have.property('result')
          r.result.should.have.property('list')
          r.result.list.should.have.property('demo.example.com')
          done( null )
        })
      })
    })

    describe(' /dashboard/app/details', function () {
      it('should return the Demo App details', function (done) {
        var options =
          { url: config.baseUrl[rs] + '/dashboard/app/details'
          , form: { id: demoApp.host }
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
          r.result.should.have.property('details')
          r.result.details.should.have.property('admins')
          r.result.details.admins.should.have.property( devUser.email )
          r.should.not.have.property('error')
          r.should.have.property('result')
          done( null )
        })
      })
    })


  })
}

// Register Demo App at all the Resource Servers
registerDemoApp( 'registrar' )
registerDemoApp( 'email' )
registerDemoApp( 'si' )
registerDemoApp( 'health', true )
registerDemoApp( 'people', true )

// Let's now act as the Demo App, get RS Tokens and call all APIs at each RS

describe('Demo App calling ', function () {
  var agentRequest
    , rsTokens
    , ixToken
  describe('getting IX Token', function () {
    it('should return an IX Token', function ( done ) {
      var agentRequestDetails =
        { 'iss': demoApp.host
        , 'aud': config.host.ix
        , 'request.a2p3.org':
         { 'resources':
              [ config.baseUrl.si + '/scope/number'
              , config.baseUrl.si + '/scope/anytime/number'
              , config.baseUrl.email + '/scope/default'
              , config.baseUrl['people.bc'] + '/scope/details'
              , config.baseUrl['health.bc'] + '/scope/prov_number'
              , config.baseUrl['health.bc'] + '/scope/series/weight/update'
              , config.baseUrl['health.bc'] + '/scope/series/weight/retrieve'
              ]
          , 'auth':
            { 'passcode': true
            , 'authorization': true
            }
          , 'returnURL': demoApp.host + '/nowhere'
          }
        }
      agentRequest = request.create( agentRequestDetails, vault.keys[config.host.ix].latest )
      should.exist( agentRequest )
      var userAgent = new agent.Create( testUser.agent )
      should.exist( userAgent )
      userAgent.ixToken( agentRequest, function ( e, ixTokenLocal ) {
        should.not.exist( e )
        should.exist( ixTokenLocal )
        ixToken = ixTokenLocal
        done()
      })
    })
  })

  var api = new API.Standard( 'demo', vault )
  describe('getting RS Tokens', function () {
    it('should return a list of RS Tokens', function (done) {
      api.call( 'ix', '/exchange', { request: agentRequest, token: ixToken }, function ( e, result ){
        should.not.exist( e )
        should.exist( result )
        result.should.have.property('sub')
        result.should.have.property('tokens')
        result.tokens.should.have.property( config.host.si )
        result.tokens.should.have.property( config.host.email )
        result.tokens.should.have.property( config.host['health.bc'] )
        result.tokens.should.have.property( config.host['people.bc'] )
        rsTokens = result.tokens
        done()
      })
    })
  })

  describe('si:/number', function(){
    it('should return SI number', function (done){
      api.call( 'si', '/number', { token: rsTokens[config.host.si] }, function ( error, result) {
        should.not.exist( error )
        should.exist( result )
        result.should.have.property('si')
        result.si.should.equal( config.testUser.si )
        done()
      })
    })
  })

  describe('email:/email/default', function(){
    it('should return email address', function (done){
      api.call( 'email', '/email/default', { token: rsTokens[config.host.email] }, function ( error, result) {
        should.not.exist( error )
        should.exist( result )
        result.should.have.property('email')
        result.email.should.equal( testUser.email )
        done()
      })
    })
  })

  describe('people:/over19', function(){
    it('should return over19 is true ', function (done){
      api.call( 'people.bc', '/over19', { token: rsTokens[config.host['people.bc']] }, function ( error, result) {
        should.not.exist( error )
        should.exist( result )
        result.should.have.property('over19')
        result.over19.should.equal( true )
        done()
      })
    })
  })

  describe('people:/under20over65', function(){
    it('should return under20over65 is false ', function (done){
      api.call( 'people.bc', '/under20over65', { token: rsTokens[config.host['people.bc']] }, function ( error, result) {
        should.not.exist( error )
        should.exist( result )
        result.should.have.property('under20over65')
        result.under20over65.should.equal( false )
        done()
      })
    })
  })

  describe('people:/namePhoto', function(){
    it('should return a name and URL to a photo ', function (done){
      api.call( 'people.bc', '/namePhoto', { token: rsTokens[config.host['people.bc']] }, function ( error, result) {
        should.not.exist( error )
        should.exist( result )
        result.should.have.property('name')
        result.should.have.property('photo')
        result.name.should.equal( config.testUser.name )
        result.photo.should.equal( config.testUser.photo )
        done()
      })
    })
  })

  describe('people:/photo', function(){
    it('should return a URL to a photo ', function (done){
      api.call( 'people.bc', '/photo', { token: rsTokens[config.host['people.bc']] }, function ( error, result) {
        should.not.exist( error )
        should.exist( result )
        result.should.not.have.property('name')
        result.should.have.property('photo')
        result.photo.should.equal( config.testUser.photo )
        done()
      })
    })
  })

  describe('people:/details', function(){
    it('should return a detailed profile ', function (done){
      api.call( 'people.bc', '/details', { token: rsTokens[config.host['people.bc']] }, function ( error, result) {
        should.not.exist( error )
        should.exist( result )
        result.should.deep.equal( config.testProfile )
        done()
      })
    })
  })

  describe('health:/prov_number', function(){
    it('should return prov_number', function (done){
      api.call( 'health.bc', '/prov_number', { token: rsTokens[config.host['health.bc']] }, function ( error, result) {
        should.not.exist( error )
        should.exist( result )
        result.should.have.property('prov_number')
        result.prov_number.should.equal( config.testUser.prov_number )
        done()
      })
    })
  })

  var access_token = null
  describe('health:/oauth', function(){
    it('should return an OAuth access token ', function (done){
      api.call( 'health.bc', '/oauth', { token: rsTokens[config.host['health.bc']] }, function ( error, result) {
        should.not.exist( error )
        should.exist( result )
        result.should.have.property( 'access_token' )
        access_token = result.access_token
        done()
      })
    })
  })

  describe('health:/series/update', function(){
    it('should return success on update ', function (done){
      var options =
        { url: config.baseUrl['health.bc'] + '/series/update'
        , form: { access_token: access_token, series: 'weight', data: '200' }
        , method: 'POST'
        }
      fetch( options, function ( e, response, body ) {
        should.not.exist( e )
        should.exist( response )
        response.statusCode.should.equal( 200 )
        should.exist( body )
        var r = JSON.parse( body )
        should.exist( r )
        r.should.not.have.property('error')
        r.should.have.property('result')
        r.result.should.have.property( 'success', true )
        done()
      })
    })
  })

  describe('health:/series/retrieve', function(){
    it('should return weight on retrieve ', function (done){
      var options =
        { url: config.baseUrl['health.bc'] + '/series/retrieve'
        , form: { access_token: access_token, series: 'weight' }
        , method: 'POST'
        }
      fetch( options, function ( e, response, body ) {
        should.not.exist( e )
        should.exist( response )
        response.statusCode.should.equal( 200 )
        should.exist( body )
        var r = JSON.parse( body )
        should.exist( r )
        r.should.not.have.property('error')
        r.should.have.property('result')
        var time = Object.keys( r.result )[0] // get first item
        r.result.should.have.property( time, '200' )
        done()
      })
    })
  })

})

describe('Agent Authorizations ', function () {
  var apps = null

  describe('getting Apps ', function () {
    it('should return a list containing the Demo app and anytime resources ', function ( done ) {
      var userAgent = new agent.Create( testUser.agent )
      should.exist( userAgent )
      var authorizations = [config.host.si, config.host['health.bc']]
      userAgent.listAuthorizations( authorizations, function ( e, result ) {
        should.not.exist( e )
        should.exist( result )
        result.should.have.property( demoApp.host )
        apps = result
        done()
      })
    })
  })

  describe('deleting authorization ', function () {
    it('should return success', function ( done ) {
      var userAgent = new agent.Create( testUser.agent )
      should.exist( userAgent )
      userAgent.deleteAuthorization( config.host['health.bc']
            , apps[demoApp.host][config.host['health.bc']].request
            , function ( e, result ) {
        should.not.exist( e )
        should.exist( result )
        result.should.have.property( 'success' )
        done()
      })
    })
  })

  describe('getting Apps ', function () {
    it('should return an empty list ', function ( done ) {
      var userAgent = new agent.Create( testUser.agent )
      should.exist( userAgent )
      var authorizations = [config.host.si, config.host['health.bc']]
      userAgent.listAuthorizations( authorizations, function ( e, result ) {
        should.not.exist( e )
        should.exist( result )
        result.should.not.have.property( demoApp.host )
        done()
      })
    })
  })

})


// describe('Restoring ', function () {
//   describe('Database', function () {
//     it('should just happen', function (done) {
//       restoreDatabase( done )
//     })
//   })
// })

// describe('Restoring Database', function (done) {
//   restoreDatabase( done )
// })

// console.log('\n =>options\n', options)

// console.log('response\n', util.inspect( response, null, 1 ) ) // 'content-type': 'text/html; charset=UTF-8',

// console.log('\n =>r\n',r)


//console.log('\nredirect\n', util.inspect( redirect, null, null ) )
// console.log('cookieJar 2\n', util.inspect( cookieJar, null, null ) )


// console.log('\njws\n',jws)
// console.log('\noptions\n',options)


