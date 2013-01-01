/* 
* Hello World registration script
*
* Copyright (C) Province of British Columbia, 2013
*/

var fetchUrl = require('fetch').fetchUrl
  , config = require('../app/config')
  , request = require('../app/request')
  , token = require('../app/token')
  , querystring = require('querystring')
  , url = require('url')
  , vaultSetup = require('../app/setup/vault')
  , api = require('../app/api')
  , jwt = require('../app/jwt')
  , db = require('../app/db')
  , async = require('async')

var setupDI       // root user Directed Identifier, fetched from Setup Agent storage
  , tasks = []
  , agentRequest
  , rsTokens
  , cookieJar

tasks =
  [ function getDI ( done ) {
      db.retrieveAgentFromDevice( 'root', function ( e, agent ) {
        if ( e ) return done( e ) 
        setupDI = agent.di
console.log('setupDI',setupDI)      
        done( null, 'ok' )
      })
    }
  , function registrarGetAgentRequest ( done ) {
      var options = { disableRedirects: true }
      fetchUrl( config.baseUrl.registrar + '/dashboard/login', options, function ( error, meta, body ) {
        if ( error ) return done( error )
        cookieJar = meta.cookieJar
        var o = url.parse( meta.responseHeaders.location, true )
        agentRequest = o.query.request
console.log('agentRequest',agentRequest)        
        done( null, 'ok' )
      })
    } 
  , function registrarLogin ( done ) {
      var jws = new jwt.Parse( agentRequest )
      var tokenPayload =
        { iss: config.host.setup
        , aud: config.host.ix
        , sub: setupDI
        , 'token.a2p3.org':
          { 'auth': jws.payload['request.a2p3.org'].auth
          , 'sar': jws.signature
          }
        }
      var ixToken = token.create( tokenPayload, vaultSetup.keys[config.host.ix].latest )
      var returnURL = jws.payload['request.a2p3.org'].returnURL + '?token=' + ixToken + '&json=true'
      var options = { disableRedirects: true, cookieJar: cookieJar }
      fetchUrl( returnURL, options, function ( error, meta, body ) {
        if ( error ) return done( error )
        var result = JSON.parse( body )
        if (result.error) return done( result.error )
        cookieJar = meta.cookieJar
console.log('we are now logged in')      
        done( null, 'ok' )
      })
    }
  ]  

async.series( tasks, function ( error, results ) {
  console.log('error:',error)
  console.log('results:',results)
})