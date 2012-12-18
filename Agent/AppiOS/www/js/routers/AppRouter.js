(function() {
	'use strict';

	window.Agent.AppRouter = Backbone.Router.extend({
	
	    routes:{
	        "" : "home",
	        "demo" : "demo",
	        "scan" : "scan",
	        "authz" : "authz",
	        "agentrequest/:id" : "agentrequest"
	    },
	
	    initialize:function () {
	        // Handle back button throughout the application
	        $('.back').live('click', function(event) {
	            window.history.back();
	            return false;
	        });
	        this.firstPage = true;
	    },
	
		/*
		 * Home page, default router
		 */
		home:function () {
	        var countItems = 0;
	       
	        console.log(countItems);
	        this.changePage(new window.Agent.HomeView());
	    },

	     /*
	     * Demo page
	     */
	    demo:function () {
	        this.changePage(new window.Agent.DemoView());
	    },

	     /*
	     * Scan page
	     */
	    scan:function () {
	        this.changePage(new window.Agent.ScanView());
	    },
	

		 /*
	     * Authz page
	     */
	    authz:function () {
	        this.changePage(new window.Agent.AuthzView());
	    },
	
		/*
		 * Agent Request
		 */
	
		agentrequest:function(id) 
		{
			var request = A2P3AgentRequest.get(id);
			this.changePage(new window.Agent.A2P3AgentRequestView({A2P3AgentRequest: request}));
		},
		
		/*
		 * Common function to load page
		 */
	    changePage:function (page) {
	    	if (page.pageClass)
	    		$(page.el).attr({ 'data-role': 'page', 'data-theme': 'c', 'class': page.pageClass});
	    	else
	    		$(page.el).attr({ 'data-role': 'page', 'data-theme': 'c'});
	        page.render();
	        $('body').append($(page.el));
	        var transition = $.mobile.defaultPageTransition;
	        
	        // We don't want to slide the first page
	        if (this.firstPage) {
	            transition = 'none';
	            this.firstPage = false;
	        }
	        $.mobile.changePage($(page.el), {changeHash:false, transition: transition});
	    }
	
	});

})();