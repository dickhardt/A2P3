/* 
* App Registration Test code
*
* Copyright (C) Province of British Columbia, 2013
*/

var should = require('chai').should() 
  , fetchUrl = require('fetch').fetchUrl
  , config = require('../app/config')
  , request = require('../app/request')
  , token = require('../app/token')
  , querystring = require('querystring')
  , url = require('url')
  , vaultSetup = require('../app/setup/vault')
  , api = require('../app/api')
  , jwt = require('../app/jwt')
  , db = require('../app/db')

var setupDI

/*
  , rsTokens
  , testUser = 
    { 'si': '123456789'
    , 'prov_number': '0123456789'
    , 'email': 'john@example.com'
    , 'profile':
      { 'name': 'John Smith'
      , 'dob': 'January 1, 1960'
      , 'address1': '100 Main Street'
      , 'address2': 'Suite 1000'
      , 'city': 'Victoria'
      , 'province': 'BC'
      , 'postal': 'V1A 1A1'
      , 'photo': 'http://example.com/photo.jpeg'
      }
    }
*/


describe('Logging into email dashboard', function(){

  var agentRequest
    , rsTokens
    , cookieJar

  describe('/dashboard/login', function(){
    it('should return an Agent Request', function (done){
      db.retrieveAgentFromDevice( 'root', function ( e, agent ) {
        should.not.exist(e)
        setupDI = agent.di
        var options = { disableRedirects: true }
        fetchUrl( config.baseUrl.email + '/dashboard/login', options, function ( error, meta, body ) {
          should.not.exist(error)
          meta.should.have.property('status')
          meta.status.should.be.equal(302)
          meta.should.have.property('cookieJar')
          cookieJar = meta.cookieJar
          meta.should.have.property('responseHeaders')
          meta.responseHeaders.should.have.property('location')
          var o = url.parse( meta.responseHeaders.location, true )
          o.should.have.property('query')
          o.query.should.have.property('request')
          agentRequest = o.query.request
          done()
        })
      })
    })
  })

  describe('/dashboard/login/return', function(){
    it('should return a redirect to /dashboard', function (done){
      var jws = new jwt.Parse( agentRequest )
      var tokenPayload =
        { iss: config.host.setup
        , aud: config.host.ix
        , sub: setupDI
        , 'token.a2p3.org':
          { 'auth': jws.payload['request.a2p3.org'].auth
          , 'sar': jws.signature
          }
        }
      var ixToken = token.create( tokenPayload, vaultSetup.keys[config.host.ix].latest )
      var url = jws.payload['request.a2p3.org'].returnURL + '?token=' + ixToken
      var options = { disableRedirects: true, cookieJar: cookieJar }
      fetchUrl( url, options, function ( error, meta, body ) {
        should.not.exist(error)
        meta.should.have.property('status')
        meta.status.should.be.equal(302)
        meta.should.have.property('cookieJar')
        cookieJar = meta.cookieJar
        meta.should.have.property('responseHeaders')
        meta.responseHeaders.should.have.property('location')
        meta.responseHeaders.location.should.be.equal(config.baseUrl.email + '/dashboard')
        done()
      })
    })
  })

  var listApps = null
  describe('/dashboard/list/apps', function(){
    it('should return a list of apps', function (done){
      var url = config.baseUrl.email + '/dashboard/list/apps'
      fetchUrl( url, { cookieJar: cookieJar }, function ( error, meta, body ) {
        should.not.exist(error)
        meta.should.have.property('status')
        meta.status.should.equal(200)
        meta.should.have.property('cookieJar')
        cookieJar = meta.cookieJar
        var response = JSON.parse(body)
        response.should.have.property('result')
        response.result.should.have.property('list')
        response.result.should.have.property('email')
        response.result.email.should.equal('root')
        listApps = response.result.list
        done()
      })
    })
  })

  describe('/dashboard/getkey', function(){
    it('should return key for an app', function (done){
      var rs = Object.keys(listApps)[0]
      var options =
          { method: 'POST' 
          , payload: querystring.stringify({'id': rs })
          , headers: {'content-type': 'application/x-www-form-urlencoded'}
          , cookieJar: cookieJar
          }
        , url = config.baseUrl.email + '/dashboard/getkey'
      fetchUrl( url, options, function ( error, meta, body ) {
        should.not.exist(error)
        meta.should.have.property('status')
        meta.status.should.equal(200)
        meta.should.have.property('cookieJar')
        cookieJar = meta.cookieJar
        var response = JSON.parse(body)
        response.should.have.property('result')
        response.result.should.have.property('id')
        response.result.id.should.equal( rs )
        done()
      })
    })
  })

})

