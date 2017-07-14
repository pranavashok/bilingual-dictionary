var sidebarOpen = false;

/* Set the width of the side navigation to 250px and the left margin of the page content to 250px and add a black background color to body */
/* function openNav() {
    document.getElementById("sidebar").style.width = "250px";
    document.getElementById("main").style.marginLeft = "250px";
    //document.body.style.backgroundColor = "rgba(0,0,0,0.4)";
    //document.getElementById("search").style.backgroundColor = "rgba(0,0,0,0.05)";
    document.sidebarOpen = true;
} */

/* Set the width of the side navigation to 0 and the left margin of the page content to 0, and the background color of body to white */
/* function closeNav() {
    document.getElementById("sidebar").style.width = "20px";
    document.getElementById("main").style.marginLeft = "0";
    //document.body.style.backgroundColor = "white";
    //document.getElementById("search").style.backgroundColor = "white";
    document.sidebarOpen = false;
} */

$(function(){
    // In order to make keyboard readonly, so that mobile 
    // keyboard doesn't pop up when using onscreen keyboard
    var isMobile = window.matchMedia("only screen and (max-width: 760px)");
    
    $(".keyboard").hide();
    
    $('#search').on('keyup focus', function(e){    
        $("#specific-results").fadeTo(200,0.05);
        if ($(this).val() == "") {
            $('#results').html("");
        }
        else {
            var parameters = { search: $(this).val() };
            $.get( '/searching', parameters, function(data) {
                $('#results').html(data);
            });
        }
    });

    $("#search").focusout(function(e) {
        setTimeout(function() {
            var isKbVisible = $(".keyboard").is(':visible');
            if (!isKbVisible) {
                $("#specific-results").fadeTo(0,1);
            }
        }, 100);
        
    });
    
    $("#keyboard-icon").click(function(e) {
        var isKbVisible = $(".keyboard").is(':visible');

        if (!isKbVisible) {
            if (isMobile.matches) {
                $("#search").attr('readonly', 'readonly');
            }
            $("#specific-results").fadeTo(0,0.05);
            $(".keyboard").show();
        }

        if (isKbVisible) {
            if (isMobile.matches) {
                $("#search").removeAttr('readonly').select();
            }
            $(".keyboard").hide();
            $("#specific-results").fadeTo(0,1);
        }            
    });
});