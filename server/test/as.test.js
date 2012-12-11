/* 
* AS Test code
*
* Copyright (C) Province of British Columbia, 2013
*/

var should = require('chai').should() 
  , fetchUrl = require('fetch').fetchUrl

var host = 'http://as.local.a2p3.net:8080'  // TBD: build this per environment

var options =
  { method: 'POST' }

debugger;  

describe('AS', function(){
  describe('/does-not-exist', function(){
    it('should return 404 when an invalid URL is called', function (done){
      options.body = JSON.stringify({device: 'does.not.exist'})
      fetchUrl( host+'/does-not-exist', options, function (error, meta, body) {
        meta.status.should.be.equal(404)
        done()
      })
    })
  })
  describe.skip('/register', function(){
    it('should return 400 when an invalid object is passed', function (done){
      options.body = JSON.stringify({device: 'does.not.exist'})
      fetchUrl( host+'/register', options, function (error, meta, body) {
        meta.status.should.be.equal(400)
        done()
      })
    })
  })
})