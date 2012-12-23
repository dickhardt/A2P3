var fs = require('fs')

var provinces = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT']

provinces.forEach( function (province ) {
  fs.mkdirSync(province)
  fs.linkSync( 'people.js', province+'/people.js')  
})
