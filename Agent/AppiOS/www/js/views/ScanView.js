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
	    	console.log("Begin scan");
	        window.barcodeScanner.scan(
                function(result) {
                	console.log("Scan success callback");
                    if (result.cancelled)
                        window.SSDriver.Notify("the user cancelled the scan")
                    else
                        window.SSDriver.Notify("we got a barcode: " + result.text)
                },
                function(error) {
                	console.log("Scan failed callback");
                    window.SSDriver.Notify("scanning failed: " + error)
                }
	   		)
	        
		},
	});
});