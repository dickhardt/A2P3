/*
* pretest.js - checks that server is running before running tests
*
* Copyright (C) Province of British Columbia, 2013
*/

var fetch = require('request')
  , config = require('../app/config')

// fetch favicon.ico to make sure server is running
var url = config.baseUrl.setup + '/favicon.ico'
fetch( url, function( error, meta, body ) {
  if (error) {
    console.error('Server must be running before testing.')
    console.error('Try "npm start".')
    process.exit(1)
  } else {
    process.exit(0)
  }
})