/* 
* CLI Agent module and script
*
* TBD: documentation!!, perhaps in README.md?
*
* Copyright (C) Province of British Columbia, 2013
*/

var fs = require('fs')
  , config = null

if fs.existsSync('./agent.config.json') {
  config = require('./agent.config.json')
}

Create = function ( options ) {
  var error = null
  var this.host = options || options.host || config || config.host || error = new Error('No host provided')
  var this.device = options || options.device || config || config.device || error = new Error('No device provided')
  var this.handle = options || options.handle || config || config.handle || error = new Error('No handle provided')
  if (error) {
    console.error( error )
    return null
  } else {
    return this
  }

}

// return an IX Token for passed Agent Request
Create.prototype.token = function ( agentRequest ) {

}

// list all apps with long term resource access
Create.prototype.list = function ( ) {

}

// revoke long term resource access for app
Create.prototype.delete = function ( handle ) {

}

// report an app for abuse
Create.prototype.report = function ( app ) {

}

exports.Create = Create
