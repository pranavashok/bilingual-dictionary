$(function(){
    $(".keyboard").hide();
    $('#search').on('propertychange change click keyup input paste focus', function(e){
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
        $(".keyboard").toggle(100);
    });
});