$(function(){
    $('#search').on('keyup', function(e){
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
});