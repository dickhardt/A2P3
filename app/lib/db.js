/*
* Database Abstraction layer
*
* Copyright (C) Province of British Columbia, 2013
*/

var config = require('../config')

if (!config.database) {
  var db_dev = require('./db_dev')
  module.exports = db_dev
} else {
  var db_redis = require('./db_redis')
  module.exports = db_redis
}