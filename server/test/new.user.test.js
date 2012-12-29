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

  // TBD -- email.local.a2p3.net needs to propogate ... 
  
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

})

