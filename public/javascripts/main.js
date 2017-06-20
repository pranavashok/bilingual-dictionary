$(function(){
    $('#search').on('keyup', function(e){
        var parameters = { search: $(this).val() };
        $.get( '/searching', parameters, function(data) {
            $('#results').html(data);
        });
    });
});