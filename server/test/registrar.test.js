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

describe('Registrar', function(){
  describe('/request/verify', function(){
    
    it('should return INVALID_TOKEN when an invalid agent token is provided', function (done){
      var options =
        { method: 'POST' 
        , payload: querystring.stringify({'token': 'invalidAgentToken'})
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

    // need to fix JWT parsing so that exceptoins are trapped
    it.skip('should return INVALID_REQUEST when an invalid request provided', function (done){
      var request = 'abcdefg'
      var options =
        { method: 'POST' 
        , payload: querystring.stringify({'token': 'testToken', 'request': request})
        , headers: {'content-type': 'application/x-www-form-urlencoded'}
        }  
      fetchUrl( host+'/request/verify', options, function (error, meta, body) {
        var response = JSON.parse(body)
        should.exist(response)
        response.should.have.property(code)
        response.code.should.equal('INVALID_REQUEST')
        done()
      })
    })

  })
})
