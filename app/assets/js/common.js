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

  // check if are running on a mobile platform to determine if we put up QR code or redirect to a2p3: scheme
  var deviceAgent = navigator.userAgent.toLowerCase()
  var iOS = deviceAgent.match(/(iphone|ipod|ipad)/)
  var isWindowsPhone8 = deviceAgent.indexOf("windows phone 8") > -1

  // the following are placeholders, there may be additional refinement as to which platforms the available agents can properly run on
  var isBlackberry10 = deviceAgent.indexOf("bb10") > -1
  var isAndroid = deviceAgent.indexOf("android") > -1

  // flag to indicate we will invoke the agent directly via a2p3: and put a link to the agent in the meta_refresh page
  config.agentDirect = iOS || isWindowsPhone8 // agents are only available for iOS and Windows Phone 8

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
 * A common utility to determine how to render the QR code.  Preferred canvas because
 * of quirks in Chrome table rendering.  Tables are used for unsupported canvas HTML5
 * tag.
 */
function getQRCodeRenderType () {
	var canvasSupported = !!window.HTMLCanvasElement;
	if (canvasSupported) {
		return "canvas"
	} else {
		return "table";
	}
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

/*
 * Backwards compatibility for browsers missing forEach, e.g., IE 8
 */
if ( !Array.prototype.forEach ) {
  Array.prototype.forEach = function(fn, scope) {
    for(var i = 0, len = this.length; i < len; ++i) {
      fn.call(scope, this[i], i, this);
    }
  }
}

/*
 * A simple way to detect if in mobile mode
 */
var isMobile = {
    Android: function() {
        return navigator.userAgent.match(/Android/i);
    },
    BlackBerry: function() {
        return navigator.userAgent.match(/BlackBerry/i);
    },
    iOS: function() {
        return navigator.userAgent.match(/iPhone|iPad|iPod/i);
    },
    Opera: function() {
        return navigator.userAgent.match(/Opera Mini/i);
    },
    Windows: function() {
        return navigator.userAgent.match(/IEMobile/i);
    },
    any: function() {
        return (isMobile.Android() || isMobile.BlackBerry() || isMobile.iOS() || isMobile.Opera() || isMobile.Windows());
    }
};