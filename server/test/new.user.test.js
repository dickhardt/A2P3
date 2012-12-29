/* 
* New User Test code
*
* Copyright (C) Province of British Columbia, 2013
*/

var should = require('chai').should() 
  , fetchUrl = require('fetch').fetchUrl
  , config = require('../app/config')
  , request = require('../app/request')
  , token = require('../app/token')
  , querystring = require('querystring')
  , vaultSetup = require('../app/setup/vault')
  , api = require('../app/api')
  , jwt = require('../app/jwt')

var diList
  , rsTokens


describe('Creating new User', function(){

  describe('ix:/di/create', function(){
    it('should return a result property', function (done){

      var details = 
        { host: 'ix'
        , api: '/di/create'
        , credentials: vaultSetup.keys[config.host.ix].latest
        , payload: 
          { iss: config.host.setup
          , aud: config.host.ix
          , 'request.a2p3.org':
            { 'AS': config.host.setup
            , 'RS': [config.host.email, config.host.si, config.host['health.bc'], config.host['people.bc']]
            , 'redirects': {}
            }
          }
        }
      details.payload['request.a2p3.org'].redirects[config.host.health] = [config.host['health.bc']]
      details.payload['request.a2p3.org'].redirects[config.host.people] = [config.host['people.bc']]

      api.call( details, function (response) {
        response.should.not.have.property('error')
        response.should.have.property('result')
        response.result.should.have.property('dis')
        response.result.dis.should.have.property(config.host.setup)
        response.result.dis.should.have.property(config.host.email)
        response.result.dis.should.have.property(config.host.si)
        response.result.dis.should.have.property(config.host['health.bc'])
        response.result.dis.should.have.property(config.host['people.bc'])
        diList = response.result.dis
        done()
      })  
    })
  })

  describe('email:/di/link', function(){
    it('should return a result property', function (done){
      var details = 
        { host: 'email'
        , api: '/di/link'
        , credentials: vaultSetup.keys[config.host.email].latest
        , payload: 
          { iss: config.host.setup
          , aud: config.host.email
          , 'request.a2p3.org':
            { 'sub': diList[config.host.email]
            , 'account': 'dickhardt@gmail.com'
            }
          }
        }
      api.call( details, function (response) {
        response.should.not.have.property('error')
        response.should.have.property('result')
        response.result.should.have.property('success')
        done()
      })  
    })
  })

  describe('si:/di/link', function(){
    it('should return a result property', function (done){
      var details = 
        { host: 'si'
        , api: '/di/link'
        , credentials: vaultSetup.keys[config.host.si].latest
        , payload: 
          { iss: config.host.setup
          , aud: config.host.si
          , 'request.a2p3.org':
            { 'sub': diList[config.host.si]
            , 'account': '123456789'
            }
          }
        }
      api.call( details, function (response) {
        response.should.not.have.property('error')
        response.should.have.property('result')
        response.result.should.have.property('success')
        done()
      })  
    })
  })

  describe('health.BC:/di/link', function(){
    it('should return a result property', function (done){
      var details = 
        { host: 'health.bc'
        , api: '/di/link'
        , credentials: vaultSetup.keys[config.host['health.bc']].latest
        , payload: 
          { iss: config.host.setup
          , aud: config.host['health.bc']
          , 'request.a2p3.org':
            { 'sub': diList[config.host['health.bc']]
            , 'account': '0123456789'
            }
          }
        }
      api.call( details, function (response) {
        response.should.not.have.property('error')
        response.should.have.property('result')
        response.result.should.have.property('success')
        done()
      })  
    })
  })

  describe('people.BC:/di/link', function(){
    it('should return a result property', function (done){
      var details = 
        { host: 'people.bc'
        , api: '/di/link'
        , credentials: vaultSetup.keys[config.host['people.bc']].latest
        , payload: 
          { iss: config.host.setup
          , aud: config.host['people.bc']
          , 'request.a2p3.org':
            { 'sub': diList[config.host['people.bc']]
            , 'profile': 
              { name: 'Dick Hardt' 
              , dob: 'May 28, 1963'
              , address1: '100 Main Street'
              , address2: 'Suite 1000'
              , city: 'Vancouver'
              , province: 'BC'
              , postal: 'V1A 1A1'
              , photo: 'https://fbcdn-profile-a.akamaihd.net/hprofile-ak-snc7/369342_504347313_724043336_q.jpg'
              }
            }
          }
        }
      api.call( details, function (response) {
        response.should.not.have.property('error')
        response.should.have.property('result')
        response.result.should.have.property('success')
        done()
      })  
    })
  })

  // NOTE: setup is both an AS and an App in this set of calls
  describe('ix:/exchange', function(){
    it('should return an array of RS tokens', function (done){
      var requestPayload =
        { iss: config.host.setup
        , aud: config.host.ix
        , 'request.a2p3.org':
          { 'returnURL': 'https://example.com/return' // not needed in test
          , 'resources':
            [ config.baseUrl.si + '/scope/number'
            , config.baseUrl.email + '/scope/default'
            ]
          , 'auth': 
            { 'passcode': true 
            , 'authorization': true
            }
          }
        }
      var agentRequest = request.create( requestPayload, vaultSetup.keys[config.host.ix].latest )
      var jws = new jwt.Parse( agentRequest )
      var tokenPayload =
        { iss: config.host.setup
        , aud: config.host.ix
        , sub: diList[config.host.setup]
        , 'token.a2p3.org':
          { 'auth': requestPayload['request.a2p3.org'].auth
          , 'sar': jws.signature
          }
        }
      var ixToken = token.create( tokenPayload, vaultSetup.keys[config.host.ix].latest )
      var details = 
        { host: 'ix'
        , api: '/exchange'
        , credentials: vaultSetup.keys[config.host.ix].latest
        , payload: 
          { iss: config.host.setup
          , aud: config.host.ix
          , 'request.a2p3.org':
            { 'token': ixToken
            , 'request': agentRequest
            }
          }
        }
      api.call( details, function (response) {
        response.should.not.have.property('error')
        response.should.have.property('result')
        response.result.should.have.property('sub')
        response.result.should.have.property('tokens')
        rsTokens = response.result.tokens
        done()
      })  
    })
  })

  describe('email:/email/default', function(){
    it('should return email address', function (done){
      var details = 
        { host: 'email'
        , api: '/email/default'
        , credentials: vaultSetup.keys[config.host.email].latest
        , payload: 
          { iss: config.host.setup
          , aud: config.host.email
          , 'request.a2p3.org':
            { 'token': rsTokens[config.host.email]
            }
          }
        }
      api.call( details, function (response) {
        response.should.not.have.property('error')
        response.should.have.property('result')
        response.result.should.have.property('email')
        response.result.email.should.equal('dickhardt@gmail.com')
        done()
      })  
    })
  })

})

