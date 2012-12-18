(function() {
	'use strict';

	// ----------
	// A2P3AgentSession Model
	// ----------

	window.Agent.AgentRequestSession = Backbone.Model.extend({

		// Default attributes
		defaults: {
			Id: '',
           	AgentRequestUrl: '', 
           	isSync: true,
		},
		
		urlRoot: window.Agent.Context.BaseUrl + '/api/AgentRequestSession',
		
		// set id to API identifier which has capital I
		idAttribute: 'Id',
		
		// Remove this from *localStorage* and delete its view.
		clear: function() {
			// remove the item from localstorage
			$.jStorage.deleteKey(this.get("Id"));
			this.destroy();
		},
		
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