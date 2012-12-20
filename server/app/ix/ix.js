/* 
* IX Server code
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')
  , request = require('../request')
  , config = require('../config')
  , vault = require('./vault')
  , util = require('util')
  , db = require('../db')

function diCreate ( req, res, next ) {
    var AS = req.a2p3['request.a2p3.org'].AS
    var rsHosts = req.a2p3['request.a2p3.org'].RS
    db.newUser( AS, rsHosts, function ( e, dis ) {
      if (e) { e.code = "INTERNAL_ERROR"; return next(e) }
      res.send( {'result': {'dis': dis}} )
    })
}

function exchange ( req, res, next ) {
    res.send(501, 'NOT IMPLEMENTED');
}

function agentList ( req, res, next ) {
    res.send(501, 'NOT IMPLEMENTED');
}

function agentAdd ( req, res, next ) {
    res.send(501, 'NOT IMPLEMENTED');
}

function agentDelete ( req, res, next ) {
    res.send(501, 'NOT IMPLEMENTED');
}

exports.app = function() {
	var app = express()
  app.use(express.limit('10kb'))  // protect against large POST attack  
  app.use(express.bodyParser())

  app.post( '/di/create', request.check( vault.keys, config.roles.enroll ), diCreate )
  app.post( '/exchange', request.check( vault.keys ), exchange ) // TBD - need to be able to check all app keys 
  app.post( '/agent/list', request.check( vault.keys, config.roles.as ), agentList )
  app.post( '/agent/add', request.check( vault.keys, config.roles.as ), agentAdd )  
  app.post( '/agent/delete', request.check( vault.keys, config.roles.as ), agentDelete )  

	app.get( "/", function(req, res){
		console.log(req.domain);
		console.log(req.headers);
	    html = 'Hello World, from IX!';
	    res.send(html);    
	});

	return app
}
