$(function(){
    // In order to make keyboard readonly, so that mobile 
    // keyboard doesn't pop up when using onscreen keyboard
    var flag = 0;
    
    $(".keyboard").hide();
    
    if (location.pathname == "/")
        $('#search').focus();
    
    $('#search').on('propertychange change click keyup input paste focus', function(e){
        if (location.pathname != "/")
            location.href = "/";
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
    
    $("#keyboard-icon").click(function(e) {
        if (flag = 0)
            flag = 1;
        else
            flag = 0;
        $(".keyboard").toggle(100);
        if (flag = 1) 
            $("#search").attr('readonly', 'readonly');
        else 
            $("#search").removeAttr('readonly').select();
    });
});