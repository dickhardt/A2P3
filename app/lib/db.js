/*
* Database Abstraction layer
*
* Copyright (C) Province of British Columbia, 2013
*/

var config = require('../config')

if (!config.db) {
  var db_dev = require('./db_dev')
  module.exports = db_dev
} else {
  console.error("Ummm, I think you need to write some code!")
}