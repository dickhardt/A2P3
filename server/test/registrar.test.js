/* 
* Registrar Test code
*
* Copyright (C) Province of British Columbia, 2013
*/

var should = require('chai').should() 
  , fetchUrl = require('fetch').fetchUrl
  , config = require('../app/config')
  , querystring = require('querystring')

var host = config.baseUrl.registrar

var appVault = require('./app.example.com.vault')
  , jwt = require('../app/jwt')
  , request = require('../app/request')

var payload = 
  { 'iss': 'app.example.com'
  , 'aud': config.host.ix
  , 'reqeuest.a2p3.org':
    { 'returnURL': 'https://app.example.com/returnURL'
    , 'resources': 
      [ 'https://health.a2p3.net/scope/prov_number'
      , 'https://people.a2p3.net/scope/details'
      ]
    , 'auth': 
      { 'passcode': true
      , 'authorization': true
      }
    }
  }

var validRequest = request.create( payload, appVault.keys[config.host.ix].latest )
var creds = appVault.keys[config.host.ix].latest
creds.kid ='abc'
var badKidRequest = request.create( payload, creds )
var creds = appVault.keys[config.host.ix].latest
creds.key[0] = creds.key[0]+1
var badKeyRequest = request.create( payload, creds )

// var r = request.parse( validRequest )
// console.log( r )

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
    
  })
})
