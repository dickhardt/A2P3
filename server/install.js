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

console.log('Copying default.config.js -> config.js')

copyFileSync( './app/default.config.js', './app/config.js')

console.log('Edit config.js to change local behaviour')
console.log('\nTo test, run "npm start" in a seperate console, then "npm test".\n')

require('./bootstrap')  // run bootstrap to build default vaults and 

