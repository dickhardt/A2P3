/* 
* New User Test code
*
* Copyright (C) Province of British Columbia, 2013
*/

var should = require('chai').should() 
  , fetchUrl = require('fetch').fetchUrl
  , config = require('../app/config')
  , request = require('../app/request')
  , querystring = require('querystring')
  , vaultSetup = require('../app/setup/vault')
  , api = require('../app/api')

var diList

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
            { 'AS': config.host.as
            , 'RS': [config.host.email, config.host.si, config.host['health.BC'], config.host['people.BC']]
            , 'redirects': {}
            }
          }
        }
      details.payload['request.a2p3.org'].redirects[config.host.health] = [config.host['health.BC']]
      details.payload['request.a2p3.org'].redirects[config.host.people] = [config.host['people.BC']]

      api.call( details, function (response) {
        response.should.not.have.property('error')
        response.should.have.property('result')
        response.result.should.have.property('dis')
        response.result.dis.should.have.property(config.host.as)
        response.result.dis.should.have.property(config.host.email)
        response.result.dis.should.have.property(config.host.si)
        response.result.dis.should.have.property(config.host['health.BC'])
        response.result.dis.should.have.property(config.host['people.BC'])
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
        { host: 'health.BC'
        , api: '/di/link'
        , credentials: vaultSetup.keys[config.host['health.BC']].latest
        , payload: 
          { iss: config.host.setup
          , aud: config.host['health.BC']
          , 'request.a2p3.org':
            { 'sub': diList[config.host['health.BC']]
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

  describe('people.BC:/di/link', function(){
    it('should return a result property', function (done){
      var details = 
        { host: 'people.BC'
        , api: '/di/link'
        , credentials: vaultSetup.keys[config.host['people.BC']].latest
        , payload: 
          { iss: config.host.setup
          , aud: config.host['people.BC']
          , 'request.a2p3.org':
            { 'sub': diList[config.host['people.BC']]
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

  describe('ix:/exchange', function(){
    it('should return an array of RS tokens', function (done){
      var agentRequest = 
      var ixToken
      var details = 
        { host: 'ix'
        , api: '/exchange'
        , credentials: vaultSetup.keys[config.host.ix].latest
        , payload: 
          { iss: config.host.setup
          , aud: config.host['people.BC']
          , 'request.a2p3.org':
            { 'token': ixToken
            , 'request': agentRequest
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

