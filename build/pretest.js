/*
* pretest.js - checks that server is running before running tests
*
* Copyright (C) Province of British Columbia, 2013
*/

var fetch = require('request')
  , config = require('../app/config')
  , exec = require('child_process').exec

// check that mocha is installed so can give useful error message if not
exec( 'mocha --version', function ( error ) {
  if (error) {
    console.error('Does not look like you have Mocha installed globally')
    console.error('Try "npm install mocha -g".\n')
    return process.exit(1)
  }
  // fetch favicon.ico to make sure server is running
  var url = config.baseUrl.setup + '/favicon.ico'
  fetch( url, function( error ) {
    if (error) {
      console.error('Server must be running before testing.')
      console.error('Try "npm start" in a different console.\n')
      return process.exit(1)
    }
    process.exit(0)
  })
})

