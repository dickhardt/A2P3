/* 
* AS Test code
*
* Copyright (C) Province of British Columbia, 2013
*/

var should = require('chai').should() 
  , fetchUrl = require('fetch').fetchUrl
  , querystring = require('querystring')
  , config = require('../app/config')
  , vault = require('../app/as/vault.js')
  , jwt = require('../app/jwt')
  , request = require('../app/request')

var host = config.baseUrl.as

var options =
  { method: 'POST' 
  , headers: {'content-type': 'application/x-www-form-urlencoded'}
  }

describe('AS', function(){
  describe('/does-not-exist', function(){
    it('should return 404 when an invalid URL is called', function (done){
      options.payload = querystring.stringify( {device: 'does.not.exist'} )
      fetchUrl( host+'/does-not-exist', options, function (error, meta, body) {
        meta.status.should.be.equal(404)
        done()
      })
    })
  })
  describe('/register', function(){

    var payload = 
      { 'iss': config.host.as
      , 'aud': config.host.as
      , 'reqeuest.a2p3.org':
        { 'register': true }
      }
    var validRequest = request.create( payload, vault.keys[config.host.as].latest )

    it('should return INVALID_API_CALL when invalid JSON is passed', function (done){
      options.payload = querystring.stringify( {'device': 'testDevice', 'passcode': '1234'} )
      fetchUrl( host+'/register', options, function (error, meta, body) {
        var response = JSON.parse(body)
        should.exist(response)
        response.should.have.property('error')
        response.error.should.have.property('code')
        response.error.code.should.equal('INVALID_API_CALL')
        done()
      })
    })
    it('should return INVALID_API_CALL when invalid JSON is passed', function (done){
      options.payload = querystring.stringify( {'device': 'testDevice', 'request': validRequest} )
      fetchUrl( host+'/register', options, function (error, meta, body) {
        var response = JSON.parse(body)
        should.exist(response)
        response.should.have.property('error')
        response.error.should.have.property('code')
        response.error.code.should.equal('INVALID_API_CALL')
        done()
      })
    })
    it('should return INVALID_API_CALL when invalid JSON is passed', function (done){
      options.payload = querystring.stringify( {'request': validRequest, 'passcode': '1234'} )
      fetchUrl( host+'/register', options, function (error, meta, body) {
        var response = JSON.parse(body)
        should.exist(response)
        response.should.have.property('error')
        response.error.should.have.property('code')
        response.error.code.should.equal('INVALID_API_CALL')
        done()
      })
    })

  var payload = 
    { 'iss': config.host.as
    , 'aud': config.host.as
    , 'reqeuest.a2p3.org':
      { 'register': true }
    }


  })
})



/*

debugger;

var validRequest = request.create( payload, appVault.keys[config.host.ix].latest )
var creds = appVault.keys[config.host.ix].latest
creds.kid ='abc'
var badKidRequest = request.create( payload, creds )
var creds = appVault.keys[config.host.ix].latest
creds.key[0] = creds.key[0]+1
var badKeyRequest = request.create( payload, creds )

describe('Registrar', function(){
  describe('/request/verify', function(){
     
     it('should return INVALID_API_CALL when no "token" parameter is passed', function (done){
      var options =
        { method: 'POST' 
        // note mispelled 'tokn'
        , payload: querystring.stringify({'tokn': 'testToken', 'request': validRequest})
        , headers: {'content-type': 'application/x-www-form-urlencoded'}
        }
      fetchUrl( host+'/request/verify', options, function (error, meta, body) {
        var response = JSON.parse(body)
        should.exist(response)
        response.should.have.property('error')
        response.error.should.have.property('code')
        response.error.code.should.equal('INVALID_API_CALL')
        done()
      })
    })

     it('should return INVALID_API_CALL when no "request" parameter is passed', function (done){
      var options =
        { method: 'POST' 
        // note mispelled 'reqest'
        , payload: querystring.stringify({'token': 'testToken', 'reqest': validRequest})
        , headers: {'content-type': 'application/x-www-form-urlencoded'}
        }
      fetchUrl( host+'/request/verify', options, function (error, meta, body) {
        var response = JSON.parse(body)
        should.exist(response)
        response.should.have.property('error')
        response.error.should.have.property('code')
        response.error.code.should.equal('INVALID_API_CALL')
        done()
      })
    })

    it('should return INVALID_TOKEN when an invalid agent token is provided', function (done){
      var options =
        { method: 'POST' 
        , payload: querystring.stringify({'token': 'invalidAgentToken', 'request': validRequest})
        , headers: {'content-type': 'application/x-www-form-urlencoded'}
        }
      fetchUrl( host+'/request/verify', options, function (error, meta, body) {
        var response = JSON.parse(body)
        should.exist(response)
        response.should.have.property('error')
        response.error.should.have.property('code')
        response.error.code.should.equal('INVALID_TOKEN')
        done()
      })
    })

    it('should return INVALID_REQUEST when an invalid request provided', function (done){
      var options =
        { method: 'POST' 
        , payload: querystring.stringify({'token': 'testToken', 'request': 'abcdef'})
        , headers: {'content-type': 'application/x-www-form-urlencoded'}
        }  
      fetchUrl( host+'/request/verify', options, function (error, meta, body) {
        var response = JSON.parse(body)
        should.exist(response)
        response.should.have.property('error')
        response.error.should.have.property('code')
        response.error.code.should.equal('INVALID_REQUEST')
        done()
      })
    })

    it('should return INVALID_REQUEST when an invalid kid is provided', function (done){
      var options =
        { method: 'POST' 
        , payload: querystring.stringify({'token': 'testToken', 'request': badKidRequest})
        , headers: {'content-type': 'application/x-www-form-urlencoded'}
        }  
      fetchUrl( host+'/request/verify', options, function (error, meta, body) {
        var response = JSON.parse(body)
        should.exist(response)
        response.should.have.property('error')
        response.error.should.have.property('code')
        response.error.code.should.equal('INVALID_REQUEST')
        done()
      })
    })

    it('should return INVALID_REQUEST when an invalid key is provided', function (done){
      var options =
        { method: 'POST' 
        , payload: querystring.stringify({'token': 'testToken', 'request': badKeyRequest})
        , headers: {'content-type': 'application/x-www-form-urlencoded'}
        }  
      fetchUrl( host+'/request/verify', options, function (error, meta, body) {
        var response = JSON.parse(body)
        should.exist(response)
        response.should.have.property('error')
        response.error.should.have.property('code')
        response.error.code.should.equal('INVALID_REQUEST')
        done()
      })
    })
    it('should return "App Example" when a valid request is provided', function (done){
      var options =
        { method: 'POST' 
        , payload: querystring.stringify({'token': 'testToken', 'request': validRequest})
        , headers: {'content-type': 'application/x-www-form-urlencoded'}
        }  
      fetchUrl( host+'/request/verify', options, function (error, meta, body) {
        var response = JSON.parse(body)
        should.exist(response)
        response.should.not.have.property('error')
        response.should.have.property('result')
        response.result.should.have.property('name')
        response.result.name.should.equal('Example App')
        done()
      })
    })

  })
})

*/
