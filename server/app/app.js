/* 
* app.js
* 
* main router for all calls, distributes calls to each server implementation 
* we run all the POC apps on one set of servers to save money
*
*	Copyright (C) Province of British Columbia, 2013
*/

Express quick setup */
var express = require('express')
var http = require('http')

var hosts = 
	{ 'ix': require('./ix/ix').create()
	, 'as': require('./as/as').create()
	}

function router( req, res) {
	var host = req.headers.host
	host = host.split('.')[0]
	if (hosts[host]) return hosts[host]( req, res )
	console.error('UKNOWN HOST:'+host,' from ', req.headers.host)
	res.send(500, 'UKNOWN HOST:'+host);
}

http.createServer(router).listen(8080);

