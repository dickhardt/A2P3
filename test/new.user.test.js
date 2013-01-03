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
  , db = require('../app/db')

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
            , 'account': config.testUser.email
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
            , 'account': config.testUser.si
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
            , 'account': config.testUser.prov_number
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
            , 'profile': config.testProfile
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

})


describe('Getting info on new User', function(){
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
            , config.baseUrl['health.bc'] + '/scope/prov_number' 
            , config.baseUrl['people.bc'] + '/scope/details'
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

  describe('si:/number', function(){
    it('should return SI number', function (done){
      var details = 
        { host: 'si'
        , api: '/number'
        , credentials: vaultSetup.keys[config.host.si].latest
        , payload: 
          { iss: config.host.setup
          , aud: config.host.si
          , 'request.a2p3.org':
            { 'token': rsTokens[config.host.si]
            }
          }
        }
      api.call( details, function (response) {
        response.should.not.have.property('error')
        response.should.have.property('result')
        response.result.should.have.property('si')
        response.result.si.should.equal( config.testUser.si )
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
        response.result.email.should.equal( config.testUser.email )
        done()
      })  
    })
  })

  describe('health:/prov_number', function(){
    it('should return prov_number', function (done){
      var details = 
        { host: 'health.bc'
        , api: '/prov_number'
        , credentials: vaultSetup.keys[config.host['health.bc']].latest
        , payload: 
          { iss: config.host.setup
          , aud: config.host['health.bc']
          , 'request.a2p3.org':
            { 'token': rsTokens[config.host['health.bc']]
            }
          }
        }
      api.call( details, function (response) {
        response.should.not.have.property('error')
        response.should.have.property('result')
        response.result.should.have.property('prov_number')
        response.result.prov_number.should.equal( config.testUser.prov_number )
        done()
      })  
    })
  })

  describe('people:/over19', function(){
    it('should return over19 is true ', function (done){
      var details = 
        { host: 'people.bc'
        , api: '/over19'
        , credentials: vaultSetup.keys[config.host['people.bc']].latest
        , payload: 
          { iss: config.host.setup
          , aud: config.host['people.bc']
          , 'request.a2p3.org':
            { 'token': rsTokens[config.host['people.bc']]
            }
          }
        }
      api.call( details, function (response) {
        response.should.not.have.property('error')
        response.should.have.property('result')
        response.result.should.have.property('over19')
        response.result.over19.should.equal( true )
        done()
      })  
    })
  })

  describe('people:/under20over65', function(){
    it('should return under20over65 is false ', function (done){
      var details = 
        { host: 'people.bc'
        , api: '/under20over65'
        , credentials: vaultSetup.keys[config.host['people.bc']].latest
        , payload: 
          { iss: config.host.setup
          , aud: config.host['people.bc']
          , 'request.a2p3.org':
            { 'token': rsTokens[config.host['people.bc']]
            }
          }
        }
      api.call( details, function (response) {
        response.should.not.have.property('error')
        response.should.have.property('result')
        response.result.should.have.property('under20over65')
        response.result.under20over65.should.equal( false )
        done()
      })  
    })
  })

  describe('people:/namePhoto', function(){
    it('should return a name and URL to a photo ', function (done){
      var details = 
        { host: 'people.bc'
        , api: '/namePhoto'
        , credentials: vaultSetup.keys[config.host['people.bc']].latest
        , payload: 
          { iss: config.host.setup
          , aud: config.host['people.bc']
          , 'request.a2p3.org':
            { 'token': rsTokens[config.host['people.bc']]
            }
          }
        }
      api.call( details, function (response) {
        response.should.not.have.property('error')
        response.should.have.property('result')
        response.result.should.have.property('name')
        response.result.should.have.property('photo')
        response.result.name.should.equal( config.testUser.name )
        response.result.photo.should.equal( config.testUser.photo )
        done()
      })  
    })
  })

  describe('people:/details', function(){
    it('should return a detailed profile ', function (done){
      var details = 
        { host: 'people.bc'
        , api: '/details'
        , credentials: vaultSetup.keys[config.host['people.bc']].latest
        , payload: 
          { iss: config.host.setup
          , aud: config.host['people.bc']
          , 'request.a2p3.org':
            { 'token': rsTokens[config.host['people.bc']]
            }
          }
        }
      api.call( details, function (response) {
        response.should.not.have.property('error')
        response.should.have.property('result')
        response.result.should.deep.equal( config.testProfile )
        done()
      })  
    })
  })


})

