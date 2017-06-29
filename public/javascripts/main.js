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