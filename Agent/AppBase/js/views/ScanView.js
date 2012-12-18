$(function($) {
	'use strict';
	
	window.Agent.ScanView = Backbone.View.extend({
	
	    template:_.template($('#scan').html()),
	
		initialize: function(Opts) {
		},
		
	    render:function (eventName) {
	        $(this.el).html(this.template());
	        
	        return this;
	    },
	
		events: {
	    	"click a[id=add-scan]": "addScan"
		},
	    
	    /*
	     * Event handler addScan(): 
	     */
	    addScan: function() {
	        window.barcodeScanner.scan(
                function(result) {
                    if (result.cancelled)
                        window.SSDriver.Notify("the user cancelled the scan")
                    else
                        window.SSDriver.Notify("we got a barcode: " + result.text)
                },
                function(error) {
                    window.SSDriver.Notify("scanning failed: " + error)
                }
	   		)
	        
		},
	});
});