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
  , vault = require('../app/setup/vault')
  , api = require('../app/api')
var host = config.host.ix 

describe('IX', function(){
  describe('/di/create', function(){
    it('should return a result property', function (done){

      var details = 
        { host: 'ix'
        , api: '/di/create'
        , credentials: vault.keys[host].latest
        , payload: 
          { iss: config.host.setup
          , aud: config.host.ix
          , 'request.a2p3.org':
            { 'AS': config.host.as
            , 'RS': [] 
            }
          }
        }
      api.call( details, function (response) {
        response.should.not.have.property('error')
        response.should.have.property('result')
        response.result.should.have.property('dis')
        response.result.dis.should.have.property(config.host.as)
        done()
      })  
    })
  })
})