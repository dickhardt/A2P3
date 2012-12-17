$(function($) {
	'use strict';
	
	window.Agent.HomeView = Backbone.View.extend({
	
	    template:_.template($('#home').html()),
	
		initialize: function(Opts) {
		},
		
	    render:function (eventName) {
	        $(this.el).html(this.template());
	        return this;
	    },
	
		events: {
	    },
	});
});