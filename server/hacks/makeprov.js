var fs_extra = require('fs-extra')
  , fs = require('fs')

var provinces = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT']

provinces.forEach( function (province ) {
  fs_extra.removeSync( 'health/'+province+'/health.js')
  fs_extra.removeSync( 'people/'+province+'/people.js')
})
