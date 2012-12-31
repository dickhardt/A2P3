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

var setupDI // root user Directed Identifier, fetched from Setup Agent storage

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
      var returnURL = jws.payload['request.a2p3.org'].returnURL + '?token=' + ixToken
      var options = { disableRedirects: true, cookieJar: cookieJar }
      fetchUrl( returnURL, options, function ( error, meta, body ) {
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
      var returnURL = config.baseUrl.email + '/dashboard/list/apps'
      fetchUrl( returnURL, { cookieJar: cookieJar }, function ( error, meta, body ) {
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
        , getKeyURL = config.baseUrl.email + '/dashboard/getkey'
      fetchUrl( getKeyURL, options, function ( error, meta, body ) {
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

  describe('/dashboard/login?json=true', function(){
    it('should return a JSON Agent Request and then a success URL', function (done){
      var options = { disableRedirects: true }
      fetchUrl( config.baseUrl.email + '/dashboard/login?json=true', options, function ( error, meta, body ) {
        should.not.exist(error)
        meta.should.have.property('status')
        meta.status.should.be.equal(200)
        meta.should.have.property('cookieJar')
        cookieJar = meta.cookieJar
        var response = JSON.parse(body)
        response.should.have.property('result')
        response.result.should.have.property('request')
        var o = url.parse( response.result.request, true )
        o.should.have.property('query')
        o.query.should.have.property('request')
        var agentRequest = o.query.request
        o.query.should.have.property('statusURL')
        var statusURL = o.query.statusURL        
        o.query.should.have.property('state')
        var state = o.query.state
        // setup call to statusURL
        statusURL += '&json=true'
        fetchUrl( statusURL, { cookieJar: cookieJar, disableRedirects: true }, function ( error, meta, body ) { 
          should.not.exist( error )
          meta.should.have.property('status')
          meta.status.should.be.equal(200)
          meta.should.have.property('cookieJar')
          cookieJar = meta.cookieJar
          should.exist( body )
          var response = JSON.parse(body)
          response.should.have.property( 'result' )
          response.result.should.have.property( 'url' )
          done()
        })
        // while status call is waiting, we will send IX Token
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
        var returnURL = jws.payload['request.a2p3.org'].returnURL + '?token=' + ixToken+'&state='+state
        fetchUrl( returnURL, { disableRedirects: true }, function ( error, meta, body ) { 
          should.not.exist(error)
          meta.should.have.property('status')
          meta.status.should.be.equal(302)
          meta.should.have.property('responseHeaders')
          meta.responseHeaders.should.have.property('location')
        })
      })
    })
  })


})

