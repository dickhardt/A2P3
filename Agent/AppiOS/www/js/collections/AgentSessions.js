window.Agent = window.Agent || {};

(function() {
	'use strict';

	// ----------
	// Agent Sessions
	// ----------

	window.Agent.AgentSessions = Backbone.Collection.extend({
		
		model: window.Agent.AgentRequestSession,
		
		initialize: function() {
			console.log('AgentRequestSession collection init');

			// load items from storage
			var a = $.jStorage.index();
			for (var i=0; i < a.length; i++)
			{
				if (a[i] != 'session')
				{
					var agentRequestSession = new window.Agent.AgentRequestSession();
					// set item from storage. Let change event
					// naturally set previous attributes to detect
					// actual changes from screen					
					agentRequestSession.set($.jStorage.get(a[i]));
					
					// best way to get this into the collection? Or does 
					// this redundantly call parse and store item back
					// in local storage?
					this.add(agentRequestSession);
				}	
			}
		},
	    
	    url: function() {
	    	return window.Agent.Context.BaseUrl + "/api/AgentSessions";
	    },
	       
	    getAgentRequestSession: function(id, key, options) {
 			options = options || {};

 	    	var success = options.success;
	    	var error = options.error;
	    	
	    	// check if agent request session item exist before attempting a fetch from server
	    	if (this.get(id) != null) {
	    		window.Agent.Notify("Previous agent request session in progress.");
	    	}
	    	else {
		    	this.fetch({ 
		    		add: true, 
		    		data: { 
		    			id: id, 
		    			key: key, 
	    			},
	    			success: success,
	    			error: error,
				});
	    	}
	    }, 
	});

})();	