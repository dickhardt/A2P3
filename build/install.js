/*
* install.js - install code for A2P3 package
*
* Copyright (C) Province of British Columbia, 2013
*/

var fs = require('fs')

function copyFileSync( src, dest ) {
  var data = fs.readFileSync( src )
  fs.writeFileSync( dest, data )
}


if ( fs.existsSync('./app/config.js') ) {
  console.log('Using existing ./app/config.sys')
} else {
  console.log('Copying ./app/default.config.js -> ./app/config.js')
  copyFileSync( './app/default.config.js', './app/config.js')
  console.log('Edit ./app/config.js to change local behaviour')
}

// safe to pull in config now
var config = require('./app/config')

if ( !config.db && fs.existsSync('./app/nosql.json') ) {
  console.log('Copying ./app/default.nosql.json -> ./app/nosql.json')
  copyFileSync( './app/default.nosql.json', './app/nosql.json')
}

require('./bootstrap').run( function ( e ) { // run bootstrap to build default vaults and register default apps
  if (e) {
    console.log(e)
    process.exit(1)
  } else {
    process.exit(0)
  }
})  

