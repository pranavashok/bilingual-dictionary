var shift = 0;
window.addEventListener("load", function() {
    var spans = document.getElementsByClassName('KeyboardKey');
    for(var i = 0; i < spans.length; i++) {
        var span = spans[i];
        
        if(('KeyboardKey').match(span.className)) {
            span.onclick = function() {
            	if(shift == 1) {
			    	shiftrelease();
			    	shift = 0;
			    }
            	var ctl = document.getElementById('search');
    			var startPos = ctl.selectionStart;
    			var endPos = ctl.selectionEnd;
            	if(startPos != endPos)
	            	ctl.value = ctl.value.slice(0, startPos) + this.innerHTML + ctl.value.slice(endPos, ctl.value.length)
	            else
	            	ctl.value = ctl.value.slice(0, startPos) + this.innerHTML + ctl.value.slice(startPos, ctl.value.length)
                var match = encodeURIComponent(this.innerHTML).match(/E0/g);
                var len;
                if(match == null) {
                    len = this.innerHTML.length;
                }
                else {
                    len = match.length;
                }
	            ctl.setSelectionRange(startPos+len, startPos+len);
	            ctl.focus();
            }
        }
        else if(('KeyboardKey space').match(span.className)) {
            span.onclick = function() {
                var ctl = document.getElementById('search');
                var startPos = ctl.selectionStart;
                var endPos = ctl.selectionEnd;
                if(startPos != endPos)
                    ctl.value = ctl.value.slice(0, startPos) + '\u0020' + ctl.value.slice(endPos, ctl.value.length);
                else
                    ctl.value = ctl.value.slice(0, startPos) + '\u0020' + ctl.value.slice(startPos, ctl.value.length);
                ctl.setSelectionRange(startPos+1, startPos+1);
                ctl.focus();
            }
        }
        else if(('KeyboardKey shiftkey').match(span.className)) {
            span.onclick = function() {
            	var ctl = document.getElementById('search');
    			var startPos = ctl.selectionStart;
    			var endPos = ctl.selectionEnd;
            	if(shift == 0) {
			    	shiftpress();
			    	shift = 1;
			    }
			    else {
			     	shiftrelease();
			     	shift = 0;
			    }
			    ctl.setSelectionRange(startPos, endPos);
	            ctl.focus();
	        }
	    }
	    else if(('KeyboardKey del').match(span.className)) {
	    	span.onclick = function() {
	    		var ctl = document.getElementById('search');
    			var startPos = ctl.selectionStart;
    			var endPos = ctl.selectionEnd;
    			if(startPos != endPos)
    				ctl.value = ctl.value.slice(0, startPos) + ctl.value.slice(endPos, ctl.value.length);
    			else
    				ctl.value = ctl.value.slice(0, startPos) + ctl.value.slice(startPos+1, ctl.value.length);
	            ctl.setSelectionRange(startPos, startPos);
	            ctl.focus();
	    	}
	    }
	    else if(('KeyboardKey bksp').match(span.className)) {
	    	span.onclick = function() {
	    		var ctl = document.getElementById('search');
    			var startPos = ctl.selectionStart;
    			var endPos = ctl.selectionEnd;
    			if(startPos != endPos) {
    				ctl.value = ctl.value.slice(0, startPos) + ctl.value.slice(endPos, ctl.value.length);
    				ctl.setSelectionRange(startPos, startPos);
    			}
    			else {
    				ctl.value = ctl.value.slice(0, startPos-1) + ctl.value.slice(startPos, ctl.value.length);
    				ctl.setSelectionRange(startPos-1, startPos-1);
    			}
    			ctl.focus();	            
	    	}
	    }
	    else if(('KeyboardKey tab').match(span.className)) {
	    	span.onclick = function() {
	    		var ctl = document.getElementById('search');
    			var startPos = ctl.selectionStart;
    			var endPos = ctl.selectionEnd;
    			if(startPos != endPos)
    				ctl.value = ctl.value.slice(0, startPos) + '\u0009' + ctl.value.slice(endPos, ctl.value.length);
    			else
    				ctl.value = ctl.value.slice(0, startPos) + '\u0009' + ctl.value.slice(startPos, ctl.value.length);
    			ctl.setSelectionRange(startPos+1, startPos+1);
    			ctl.focus();
	    	}
	    }
	    else if(('KeyboardKey enter').match(span.className)) {
	    	span.onclick = function() {
	    		var ctl = document.getElementById('search');
    			var startPos = ctl.selectionStart;
    			var endPos = ctl.selectionEnd;
    			if(startPos != endPos)
    				ctl.value = ctl.value.slice(0, startPos) + '\u000A' + ctl.value.slice(endPos, ctl.value.length);
    			else
    				ctl.value = ctl.value.slice(0, startPos) + '\u000A' + ctl.value.slice(startPos, ctl.value.length);
    			ctl.setSelectionRange(startPos+1, startPos+1);
    			ctl.focus();
	    	}
	    }
    }
    document.onkeydown = (function (ev) {
		var key;
		var isShift;
		if (window.event) {
			key = window.event.keyCode;
		    isShift = !!window.event.shiftKey; // typecast to boolean
		} else {
		    key = ev.which;
		    isShift = !!ev.shiftKey;
		}
		if ( isShift ) {
		    switch (key) {
		        case 16:
		      	if(shift == 0) {
		      		shiftpress();
		      		shift = 1;
		      	}
		      	else {
		      		shiftrelease();
		      		shift = 0;
		      	}
		        break;
		    	default:
		    	shift = 0;
		    	break;
			}
		}
	});
});

function shiftpress() {
	var nonshifts = document.getElementsByClassName("nonshift");
    for(var i = 0; i < nonshifts.length; i++) {
    	nonshifts[i].style.display = 'none';
    }
    var shifts = document.getElementsByClassName("shift");
    for(var i = 0; i < nonshifts.length; i++) {
    	shifts[i].style.display = 'block';
    }
}

function shiftrelease() {
	var nonshifts = document.getElementsByClassName("nonshift");
    for(var i = 0; i < nonshifts.length; i++) {
    	nonshifts[i].style.display = 'block';
    }
    var shifts = document.getElementsByClassName("shift");
    for(var i = 0; i < nonshifts.length; i++) {
    	shifts[i].style.display = 'none';
    }
}

function textbox()
{
    var ctl = document.getElementById('search');
    var startPos = ctl.selectionStart;
    var endPos = ctl.selectionEnd;
}