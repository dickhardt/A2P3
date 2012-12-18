(function() {
	'use strict';

	// ----------
	// Session Model
	// ----------

	window.Agent.Session = Backbone.Model.extend({

		// Default attributes
		defaults: {
			deviceId : '',
		},

		urlRoot: window.Agent.Context.BaseUrl + '/api/Sessions',
		
		initialize: function() {
			
		},

		sync: function(method, model, options) {
			if (method === 'create') {
				return $.ajax(options);
			}
			else {
				Backbone.sync(method, model, options);
			}
			
		},
	});

})();