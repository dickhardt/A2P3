var config = {};
// namespace wrapper function
(function() {

  var url = $.url()
  config.protocol = url.attr('protocol')
  config.fullhost = url.attr('host')
  config.port = url.attr('port')
  config.query = url.attr('query')
  var parts =  config.fullhost.split('.')
  if (parts[1].length === 2) {  // we have a province
    config.province = parts[1]
    config.host = parts[0] + '.' + parts[1]
    config.subhost = parts[0]
  } else {
    config.subhost = config.host = parts[0]
  }
  try {
    config.baseDomain = config.fullhost.replace( config.host+'.', '' )
  }
  catch (e) {
    //console.log(e)
  }
  config.provinceNames =
    { 'ab': 'Alberta'
    , 'bc': 'British Columbia'
    , 'mb': 'Manitoba'
    , 'nb': 'New Brunswick'
    , 'nl': 'Newfoundland and Labrador'
    , 'ns': 'Nova Scotia'
    , 'nt': 'Northwest Territories'
    , 'nu': 'Nunavut'
    , 'on': 'Ontario'
    , 'pe': 'Prince Edward Island'
    , 'qc': 'Quebec'
    , 'sk': 'Saskatchewan'
    , 'yt': 'Yukon'
    }

//console.log('config\n',config)

})();

// config.init()