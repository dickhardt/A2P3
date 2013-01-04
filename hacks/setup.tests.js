/* 
* Setup test script
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
  , util = require('util')
  , helloConfig = require('../helloWorld/config')

var setupDI       // root user Directed Identifier, fetched from Setup Agent storage
  , tasks = []
  , agentRequest
  , rsTokens
  , cookieJar


var options =
  { method: 'POST'
  , disableRedirects: true
  , payload: querystring.stringify( {'email': config.testUser.email} )
  , headers: {'content-type': 'application/x-www-form-urlencoded'}
  }

function done ( error, result ) { console.log('error,result:', error, result) }


fetchUrl( config.baseUrl.setup + '/dev/login', options, function ( error, meta, body ) {
  if ( error ) return done( error )
  cookieJar = meta.cookieJar
  var options =
    { method: 'POST'
    , cookieJar: cookieJar
    , disableRedirects: true
    , headers: {'content-type': 'application/x-www-form-urlencoded'}
    }        

  fetchUrl( config.baseUrl.setup + '/enroll/profile', options, function ( error, meta, body ) {
    if ( error ) return done( error )
    cookieJar = meta.cookieJar
    try {
      var profile = JSON.parse( body )        
    }
    catch (e) {
      return console.log ( e, body.toString() )
    }

    var options =
      { method: 'POST'
      , cookieJar: cookieJar
      , disableRedirects: true
      , payload: querystring.stringify( profile )
      , headers: {'content-type': 'application/x-www-form-urlencoded'}
      }        
    fetchUrl( config.baseUrl.setup + '/enroll/register', options, function ( error, meta, body ) {
      if ( error ) return done( error )
      cookieJar = meta.cookieJar
      try {
        var result = JSON.parse( body )        
      }
      catch (e) {
        return console.log ( e, body.toString() )
      }
      console.log('\nenroll/register result',result)

      var options =
        { method: 'POST'
        , cookieJar: cookieJar
        , payload: querystring.stringify( { 'name': 'MacPro' } )
        , headers: {'content-type': 'application/x-www-form-urlencoded'}
        }        
      fetchUrl( config.baseUrl.setup + '/dashboard/agent/list', options, function ( error, meta, body ) {
        if ( error ) return done( error )
        cookieJar = meta.cookieJar
        try {
          var result = JSON.parse( body )        
        }
        catch (e) {
          return console.log ( e, body.toString() )
        }
        console.log('\nagent/list result', util.inspect( result, null, null ) )
        var options =
          { method: 'POST'
          , cookieJar: cookieJar
          , payload: querystring.stringify( { 'name': 'MacPro' } )
          , headers: {'content-type': 'application/x-www-form-urlencoded'}
          }        
        fetchUrl( config.baseUrl.setup + '/dashboard/agent/create', options, function ( error, meta, body ) {
          if ( error ) return done( error )
          cookieJar = meta.cookieJar
          try {
            var result = JSON.parse( body )        
          }
          catch (e) {
            return console.log ( e, body.toString() )
          }
          console.log('\nagent/create result',result)

          var options =
            { method: 'POST'
            , cookieJar: cookieJar
            , payload: querystring.stringify( { 'name': 'MacPro' } )
            , headers: {'content-type': 'application/x-www-form-urlencoded'}
            }        
          fetchUrl( config.baseUrl.setup + '/dashboard/agent/list', options, function ( error, meta, body ) {
            if ( error ) return done( error )
            cookieJar = meta.cookieJar
            try {
              var result = JSON.parse( body )        
            }
            catch (e) {
              return console.log ( e, body.toString() )
            }
            var agentHandles = result.result.handles
            console.log('\nagent/list result', util.inspect( result, null, null ) )
            console.log('\nagent/list agentHandles', util.inspect( agentHandles, null, null ) )
            
            var handleToDelete = Object.keys(agentHandles)[0]
            var options =
              { method: 'POST'
              , cookieJar: cookieJar
              , payload: querystring.stringify( { 'handle': handleToDelete } )
              , headers: {'content-type': 'application/x-www-form-urlencoded'}
              }
            console.log('\ndeleting handle:',handleToDelete)          
            fetchUrl( config.baseUrl.setup + '/dashboard/agent/delete', options, function ( error, meta, body ) {
              if ( error ) return done( error )
              cookieJar = meta.cookieJar
              try {
                var result = JSON.parse( body )        
              }
              catch (e) {
                return console.log ( e, body.toString() )
              }
              console.log('\nagent/delete result', util.inspect( result, null, null ) )

              var options =
                { method: 'POST'
                , cookieJar: cookieJar
                , payload: querystring.stringify( { 'name': 'MacPro' } )
                , headers: {'content-type': 'application/x-www-form-urlencoded'}
                }        
              fetchUrl( config.baseUrl.setup + '/dashboard/agent/list', options, function ( error, meta, body ) {
                if ( error ) return done( error )
                cookieJar = meta.cookieJar
                try {
                  var result = JSON.parse( body )        
                }
                catch (e) {
                  return console.log ( e, body.toString() )
                }
                console.log('\nagent/list result', util.inspect( result, null, null ) )
              })   
            })   
          })   
        })   
      })   
    })   
  })
})
