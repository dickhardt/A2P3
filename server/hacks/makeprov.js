var fs_extra = require('fs-extra')
  , fs = require('fs')

var provinces = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT']

provinces.forEach( function (province ) {
  //fs_extra.removeSync( province+'/people.js')
  fs.symlinkSync( 'src/people.js', province+'/people.js')  
})
