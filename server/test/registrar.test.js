/* 
* Registrar Test code
*
* Copyright (C) Province of British Columbia, 2013
*/

var should = require('chai').should() 
  , fetchUrl = require('fetch').fetchUrl
  , config = require('../app/config')

var host = config.host.registrar 

var options =
  { method: 'POST' }

describe('Registrar', function(){
  describe('/does-not-exist', function(){
    it('should return 404 when an invalid URL is called', function (done){
      fetchUrl( host+'/does-not-exist', options, function (error, meta, body) {
        meta.status.should.be.equal(404)
        done()
      })
    })
  }) 
})