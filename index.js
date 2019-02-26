require('dotenv').config({path : 'config.env'});

var express = require('express')
var app = express()
var path = require('path');

var azure = require('azure-storage');

var config = {
   storageAccount: process.env.AZURE_STORAGE_ACCOUNT,
   storageAccessKey: process.env.AZURE_STORAGE_ACCESS_KEY,
   connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
   db1: "dictengtokon",
   db2: "dictkontoeng"
};

var tableService = azure.createTableService();

app.set('ipaddress', (process.env.IP || "0.0.0.0"));
app.set('port', (process.env.PORT || 8080));

app.set('views', './views')
app.set('view engine', 'pug')

app.use(express.static(path.join(__dirname, 'public')));

app.locals.pretty = true;

app.use(function(req, res, next) {
	res.locals.user = req.user;
	next();
});

app.get('/', function (req, res) {	
	res.render('index', { title: 'A Southern Konkani Vocabulary Collection', heading: 'A Southern Konkani Vocabulary Collection'});
})

app.get('/about|/suggest|/contact', function (req, res) {	
	res.render('contact', { title: 'A Southern Konkani Vocabulary Collection', heading: 'A Southern Konkani Vocabulary Collection'});
})

function unique_entries_by_column(entries, column) {
	unique_entries = [];
	unique_words = [];
	entries.forEach(function(row) {
		if (!unique_words.includes(row[column]._)) {
			unique_entries.push(row);
            unique_words.push(row[column]._);
		}
	}, this);
	return unique_entries;
}

function unique_words_by_column(entries, column) {
    unique_words = [];
    entries.forEach(function(row) {
        if (row[column] && !unique_words.includes(row[column]._)) {
            unique_words.push(row[column]._);
        }
    }, this);
    return unique_words;
}

// Next word in dict order
function next_word(word) {
	length = word.length - 1;
	word_upper = word.substring(0, length) + String.fromCharCode(word[length].charCodeAt() + 1)
	return word_upper;
}

app.get('/searching', function(req, res) {
	search_param = req.query.search;

    // Handle empty requests
    if (search_param === "") {
        res.send("");
        return;
    }

	// If typing in English, then
	if (search_param.search(/^([x00-\xFF]+)/) != -1) {
		primary_column = "english_word";
		secondary_column = "konkani_word";
		primary_table = config.db1;
		secondary_table = config.db2;
        suggest_table = 'suggesteng';
	} else {
		primary_column = "konkani_word";
		secondary_column = "english_word";
		primary_table = config.db2;
		secondary_table = config.db1;
        suggest_table = 'suggestkon';
	}
	
	var data = "";

	var startswith_query = new azure.TableQuery()
					.select([primary_column])
					.top(30)
					.where("PartitionKey ge ? and PartitionKey lt ?", search_param.toLowerCase(), next_word(search_param).toLowerCase());

    var containingwords_query = new azure.TableQuery()
                    .select(['RowKey', 'ParentWord', 'StrippedWord'])
                    .where("PartitionKey ge ? and PartitionKey lt ?", search_param.toLowerCase(), next_word(search_param).toLowerCase());

	tableService.queryEntities(primary_table, startswith_query, null, function(error, result, response) {
		data += "<table class=\"results-table\" id=\"dict-results-table\">";
		if(!error && result.entries.length > 0) {
			data += "<thead><tr><td>Dictionary-style matches</td></tr></thead>";
			data += "<tbody>";
			
			var unique_words = unique_words_by_column(result.entries, primary_column);
			unique_words.forEach(function(word) {
				data += "<tr><td><a href=\"/words/" + word.replace(/ /g, '+') + "\">" + word + "</a></td></tr>";
			}, this);
			data += "</tbody>";
		} else {
			data += "<thead><tr><td>No exact matches</td></tr></thead>";
			data += "</thead>";
		}
		data += "</table>";

        // Pick entries which contain query word in any way
        tableService.queryEntities(suggest_table, containingwords_query, null, function(error, result, response) {
            data += "<table class=\"results-table\" id=\"suggested-results-table\">";
            if(!error && result.entries.length > 0) {
                data += "<thead><tr><td>Suggested matches</td></tr></thead>";
                data += "<tbody>";

                var unique_suggested_words = unique_words_by_column(result.entries, 'ParentWord');
                // Remove words which are already present in unique_words
                if (unique_words) {
                    unique_suggested_words = unique_suggested_words.filter(x => unique_words.indexOf(x) < 0 );
                }

                unique_suggested_words.forEach(function(word) {
                    data += "<tr><td><a href=\"/words/" + word.replace(/ /g, '+') + "\">" + word + "</a></td></tr>";
                }, this);
                data += "</tbody>";
            } else {
                data += "<thead><tr><td>No other suggestions</td></tr></thead>";
                data += "</thead>";
            }
            data += "</table>";

            res.send(data);
        });

        // TODO: Ignore first word and pick stuff which are edit distance close, order them alphabetically

	});
});

app.get("/words/:word", function(req, res) {
	word = req.params.word.replace(/\+/g, ' ');
	// If typing in English, then
	if (word.search(/^([x00-\xFF]+)/) != -1) {
		primary_column = "english_word";
		secondary_column = "konkani_word";
		primary_table = "dictengtokon";
		secondary_table = "dictkontoeng";
        suggest_table = 'suggesteng';
	} else {
		primary_column = "konkani_word";
		secondary_column = "english_word";
		primary_table = "dictkontoeng";
		secondary_table = "dictengtokon";
        suggest_table = 'suggestkon';
	}

	// TODO: Update browse_count

	// TODO: Related words, same subcategory words

	var exact_word_query = new azure.TableQuery()
					.select([secondary_column, 'part_of_speech', 'subcategory', 'more_details'])
					.where("PartitionKey ge ? and PartitionKey lt ? and " + primary_column + " eq ?", word.toLowerCase(), next_word(word).toLowerCase(), word.toLowerCase());

    var containingwords_query = new azure.TableQuery()
                    .select(['RowKey', 'ParentWord', 'StrippedWord'])
                    .where("PartitionKey eq ?", word.toLowerCase());

	tableService.queryEntities(primary_table, exact_word_query, null, function(error, result, response) {
		if(!error && result.entries.length > 0) {
            main_result = result;

            // Pick entries which contain query word in any way
            var related_entries = [];
            tableService.queryEntities(suggest_table, containingwords_query, null, function(error, result, response) {
                if(!error && result.entries.length > 0) {
                    related_entries = unique_entries_by_column(result.entries, 'ParentWord');
                }

                // Same subcategory words
                var samesubcat_query = new azure.TableQuery()
                            .select([primary_column, 'subcategory'])
                            .where('subcategory eq ?', main_result.entries[0].subcategory._);

                var samesubcat_entries = [];
                tableService.queryEntities(primary_table, samesubcat_query, null, function(error, result, response) {
                    if(!error && result.entries.length > 0) {
                        samesubcat_entries = unique_entries_by_column(result.entries, primary_column);
                    }

                    res.render('words',
                        { title: 'A Southern Konkani Vocabulary Collection',
                        heading: 'A Southern Konkani Vocabulary Collection',
                        query: word,
                        words: main_result.entries,
                        related_words: related_entries,
                        same_subcat_words: samesubcat_entries
                    });
                });
            });
        } else {
            res.render('words',
                    { title: 'A Southern Konkani Vocabulary Collection',
                    heading: 'A Southern Konkani Vocabulary Collection',
                    query: word,
                    words: [],
                    related_words: [],
                    same_subcat_words: []
            });
        }
	});	

});

app.listen(app.get('port'), app.get('ipaddress'), function() {
	console.log('App is running, server is listening on host:port ', app.get('ipaddress'), ':', app.get('port'));
});
