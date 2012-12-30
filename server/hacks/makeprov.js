var fs_extra = require('fs-extra')
  , fs = require('fs')

var provinces = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT']

provinces.forEach( function (province ) {
  fs_extra.removeSync( province+'/health.js')
  fs.symlinkSync( 'src/health.js', province+'/health.js')  
})
