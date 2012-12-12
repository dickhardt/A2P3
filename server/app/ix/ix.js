/* 
* IX Server code
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')
  , request = require('../../request')
  , config = require('../../config')
  , vault = require('./vault')
  , util = require('util')

function diCreate (req, res) {

    var AS = req.a2p3['request.a2p3.org'].AS
    var r = {result:{dis:{}}}
    r.result.dis[AS] = 'abcdefg' // TBD: add in real work!
    res.send( r );
}

function exchange (req, res) {
    res.send(501, 'NOT IMPLEMENTED');
}

function agentList (req, res) {
    res.send(501, 'NOT IMPLEMENTED');
}

function agentAdd (req, res) {
    res.send(501, 'NOT IMPLEMENTED');
}

function agentDelete (req, res) {
    res.send(501, 'NOT IMPLEMENTED');
}

exports.app = function() {
	var app = express()
  app.use(express.limit('10kb'))  // protect against large POST attack  
  app.use(express.bodyParser())

  app.post( '/di/create', request.check(vault), diCreate )
  app.post( '/exchange', request.check(vault), exchange )
  app.post( '/agent/list', request.check(vault), agentList )
  app.post( '/agent/add', request.check(vault), agentAdd )  
  app.post( '/agent/delete', request.check(vault), agentDelete )  

	app.get( "/", function(req, res){
		console.log(req.domain);
		console.log(req.headers);
	    html = 'Hello World, from IX!';
	    res.send(html);    
	});

	return app
}
