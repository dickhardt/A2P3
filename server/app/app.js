/* 
* app.js
* 
* main router for all calls, distributes calls to each server implementation 
* we run all the POC apps on one set of servers to save money
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')
var http = require('http')

var hosts = 
  { 'ix': require('./ix/ix').create()
  , 'as': require('./as/as').create()
  , 'registrar': require('./registrar/registrar').create()
  }

function hostRouter( req, res) {

  var host = req.headers.host
  host = host.split('.')[0]
  if (hosts[host]) return hosts[host]( req, res )
  console.error('UKNOWN HOST:'+host,' from ', req.headers.host)
  res.send(500, 'UKNOWN HOST:'+host);
}

http.createServer( hostRouter ).listen(8080);

