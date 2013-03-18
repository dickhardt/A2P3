var config = {};
// namespace wrapper function
(function() {

  config.protocol = window.location.protocol
  config.fullhost = window.location.host
  config.port = window.location.port
  config.query = window.location.pathname
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
    // console.log(e)
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

// detect if running on platform that supports having a Personal Agent

  var deviceAgent = navigator.userAgent.toLowerCase()
  var iOS = deviceAgent.match(/(iphone|ipod|ipad)/)
  var isAndroid = deviceAgent.indexOf("android") > -1
  config.agentDirect = iOS   // || isAndroid // don't support Android yet

// Google Analytics

  var _gaq = _gaq || [];
  _gaq.push(['_setAccount', 'UA-38150737-1']);
  _gaq.push(['_trackPageview']);

  (function() {
    var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
    ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';
    var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
  })();


})();

// config.init()

/*
 * Common utility to canculate width and height of the qr code.
 * Depends on jquery.  Returns a minimum of 120 if browser is too small and
 * a maximum of 400 as to not make the person lean back in their chair.
 */
function getQRCodeSize () {
	var height = $(document).height(); 
	var width = $(document).width();

	var max = Math.min(height, width, 400 + 120);
	
	return Math.max(max - 120, 120);
}

/*
 * Backwards compatibility for browsers mising Object.keys, e.g., IE 8
 */
Object.keys = Object.keys || function(o) {  
    var result = [];  
    for(var name in o) {  
        if (o.hasOwnProperty(name))  
          result.push(name);  
    }  
    return result;  
};