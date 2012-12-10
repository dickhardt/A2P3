(function() {
	'use strict';

	window.Agent.AppRouter = Backbone.Router.extend({
	
	    routes:{
	        "" : "home",
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