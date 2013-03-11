/*
 * Common utility to canculate width and height of the qr code.
 * Depends on jquery.  Returns a minimum of 120 if browser is too small;
 */
function getQRCodeSize () {
	var height = $(document).height(); 
	var width = $(document).width();
	
	var min = Math.min (height, width);
	
	return Math.max(min - 120, 120);
}