/*
* requestJar.js
*
* warpper for npm request module that manages seperate cookie jars for each host
*
* really should patch the request package, but this is easy, short term fix
*
* Copyright (C) Province of British Columbia, 2013
*/


var request = require('request')
  , parseUrl = require('url').parse

var cookieJar = {}

exports.fetch = function ( options, cb ) {
  var url = parseUrl( options.url )
  cookieJar[url.host] = cookieJar[url.host] || request.jar()
  options.jar = cookieJar[url.host]
  request( options, cb )
}

exports.cookieJar = cookieJar