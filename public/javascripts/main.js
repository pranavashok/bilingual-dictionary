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
    $(".keyboard").hide();
    
    var currentRequest = null;

    $('#search').on('keyup focus', function(e){
        // $(".homepage-container").animate({"margin-top": "0"}, "fast");

        $("#specific-results").fadeTo(200,0.1);

        var query = $(this).val();

        if (!query) {
            if(currentRequest != null) {
                currentRequest.abort();
            }
            $('#results').html("");
            return;
        }

        currentRequest = $.ajax({
            type: 'GET',
            data: 'search=' + query,
            url: '/searching',
            beforeSend : function()    {           
                if(currentRequest != null) {
                    currentRequest.abort();
                }
            },
            success: function(data) {
                $('#results').html(data);
            },
            error:function(e){
                $('#results').html("");
            }
        });
    });

    $("#search").focusout(function(e) {
        setTimeout(function() {
            var isKbActive = $(".keyboard").is(':active');
            var clickingOnResult = $("#results").is(':active');
            // Show specific results only if 
            // focus is not on keyboard
            // focus is outside the result box
            if (!isKbActive && !clickingOnResult) {
                $("#specific-results").fadeTo(0,1);
                // Clear results
                // $("#results").html("");
            }
        }, 100);
    });
});

function onSceenKeyboard() {
    var isKbSelected = $("#opt-keyboard").is(":checked");
    var isMobile = window.matchMedia("only screen and (max-width: 760px)");
    var isKbVisible = $(".keyboard").is(':visible');

    if (isKbSelected && !isKbVisible) {
        if (isMobile.matches) {
            $("#search").attr('readonly', 'readonly');
        }
        $("#specific-results").fadeTo(0,0.05);
        $(".keyboard").show("slide");
    }

    if (!isKbSelected) {
        if (isMobile.matches) {
            $("#search").removeAttr('readonly').select();
        }
        $(".keyboard").hide("slide");
        $("#specific-results").fadeTo(0,1);
    }            
}