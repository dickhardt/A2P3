/* 
* app.js
* 
* main router for all calls, distributes calls to each server implementation 
* we run all the POC apps on one set of servers to save money
*
* Copyright (C) Province of British Columbia, 2013
*/

var express = require('express')
  , config = require('./config')
  , app = express()
  , mw = require('./middleware')

// common assets
app.use( express.static( __dirname + '/assets' ) )

// setup logging after static files so we only log API calls
app.use( mw.colorLogger( express ))

// use app server per host called (alphabetical so we can check we did not miss one!)
app.use( express.vhost( config.host.as, require('./as/as').app() ) ) 
app.use( express.vhost( config.host.bank, require('./bank/bank').app() ) ) 
app.use( express.vhost( config.host.clinic, require('./clinic/clinic').app() ) ) 
app.use( express.vhost( config.host.email, require('./email/email').app() ) ) 
app.use( express.vhost( config.host.health, require('./health/health').app() ) ) 
app.use( express.vhost( config.host.ix, require('./ix/ix').app() ) )
app.use( express.vhost( config.host.people, require('./people/people').app() ) ) 
app.use( express.vhost( config.host.registrar, require('./registrar/registrar').app() ) )
app.use( express.vhost( config.host.setup, require('./setup/setup').app() ) ) 
app.use( express.vhost( config.host.si, require('./si/si').app() ) ) 

// add in standardized resource servers
config.provinces.forEach( function ( province ) {
  app.use( express.vhost( config.host['health.'+province], require('./health/common/health').app( province ) ) ) 
  app.use( express.vhost( config.host['people.'+province], require('./people/common/people').app( province ) ) ) 
})

// in case we get called with a host we don't understand
app.use( express.vhost( '*', function ( req, res, next ) {
  console.error('UKNOWN HOST:'+host,' from ', req.headers.host )
  res.send(500, 'UKNOWN HOST:'+host )
}) )

app.listen( config.portListen )

console.log( "A2P3 servers started on *."+config.baseDomain+':'+config.portListen)
// TBD output DB, cluster config information
console.log( "Setup available at "+config.baseUrl.setup+"\n")
