require('dotenv').config({path : 'config.env'});
let throng = require('throng');
let Queue = require("bull");
let azure = require('azure-storage');
let Redis = require('ioredis');

// Connect to a local redis intance locally, and the Heroku-provided URL in production
let REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

// Spin up multiple processes to handle jobs to take advantage of more CPU cores
// See: https://devcenter.heroku.com/articles/node-concurrency for more info
let workers = process.env.WEB_CONCURRENCY || 1;
console.log(`Spawning ${workers} workers...`);

// The maxium number of jobs each worker should process at once. This will need
// to be tuned for your application. If each job is mostly waiting on network 
// responses it can be much higher. If each job is CPU-intensive, it might need
// to be much lower.
let maxJobsPerWorker = 50;

let config = {
    storageAccount: process.env.AZURE_STORAGE_ACCOUNT,
    storageAccessKey: process.env.AZURE_STORAGE_ACCESS_KEY,
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
    // Rollbar
    post_client_item: process.env.POST_CLIENT_ITEM_ACCESS_TOKEN,
    post_server_item: process.env.POST_SERVER_ITEM_ACCESS_TOKEN,
    env: process.env.NODE_ENV,
    db1: "dictengtokon",
    db2: "dictkontoeng"
 };
 
let tableService = azure.createTableService();

let client = new Redis(REDIS_URL);
let subscriber = new Redis(REDIS_URL);

let opts = {
  createClient: function (type) {
    switch (type) {
      case 'client':
        return client;
      case 'subscriber':
        return subscriber;
      default:
        return new Redis(REDIS_URL);
    }
  }
}

function start() {
    // Connect to the named work queue
    let azure_queue = new Queue('azure-queue', opts);

    azure_queue.process(concurrency=maxJobsPerWorker, async (job) => {
        console.log(`Processing job ${job.id}...`);
        return await query_azure(job.data.primary_table, 
            job.data.secondary_table, 
            job.data.primary_column, 
            job.data.secondary_column, 
            job.data.suggest_table, 
            job.data.search_param)
    });
}

// Next word in dict order
function next_word(word) {
	length = word.length - 1;
	word_upper = word.substring(0, length) + String.fromCharCode(word[length].charCodeAt() + 1)
	return word_upper;
}

function remove_nonsearchable(entries, column, num) {
    var keep = [];
    entries.forEach(function(row) {
        if (row.hasOwnProperty('searchable')) {
            if (!(row.searchable._ === num || row.searchable._ === String(num))) {
                keep.push(row);
            }
        } else {
            keep.push(row);
        }
    });
    return keep;
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

// TODO: Call this somewhere
function log_search(search_param, primary_column) {
    // Log searches
    if (search_param.length >= 3 && config.env === "production") {
        var task = {
            PartitionKey : {'_': primary_column, '$':'Edm.String'},
            RowKey: {'_': String(Date.now()), '$':'Edm.String'},
            query: {'_': search_param, '$':'Edm.String'},
            complete: {'_': false, '$': 'Edm.Boolean'}
        };
        tableService.insertEntity('searchlog', task, function(error) {
            if(error) {
                rollbar.error("Error occured when inserting entity into searchlog", error, {entity: task}, req);
            }
        }); 
    }
}

function query_azure(primary_table, secondary_table, primary_column, secondary_column, suggest_table, search_param) {
    return new Promise((resolve, reject) => {
        console.log("Inside query_azure() with parameter " + search_param);
        try {
            var startswith_query = new azure.TableQuery()
                        .select([primary_column, 'searchable'])
                        .top(30)
                        .where("PartitionKey ge ? and PartitionKey lt ?", search_param.toLowerCase(), next_word(search_param).toLowerCase());

            var containingwords_query = new azure.TableQuery()
                        .select(['RowKey', 'ParentWord', 'StrippedWord'])
                        .top(30)
                        .where("PartitionKey ge ? and PartitionKey lt ?", search_param.toLowerCase(), next_word(search_param).toLowerCase());

            let promise = new Promise((resolve, reject) => {
                tableService.queryEntities(primary_table, startswith_query, null, function(error, result, response) {
                    console.log("Inside first queryEntities with parameter " + search_param);
                    if (error) {
                        reject({error: error});
                    }
                    else if (result.entries.length > 0) {
                        searchable_entries = remove_nonsearchable(result.entries, primary_column, 0);
                        unique_words = unique_words_by_column(searchable_entries, primary_column);
                    } else {
                        unique_words = null;
                    }
                    resolve(unique_words);
                });
            }).then(unique_words => {
                return new Promise((resolve, reject) => {
                    tableService.queryEntities(suggest_table, containingwords_query, null, function(error, result, response) {
                        reject({search_param: search_param, unique_words: unique_words, error: error});
                        console.log("Inside second queryEntities with parameter " + search_param);
                        if (error) {
                            // In case unique_words query succeeds, but suggested words query fails, then reject the current promise
                            reject({search_param: search_param, unique_words: unique_words, error: error});
                        }
                        else if (result.entries.length > 0) {
                            unique_suggested_words = unique_words_by_column(result.entries, 'ParentWord');
                            // Remove words which are already present in unique_words
                            if (unique_words) {
                                unique_suggested_words = unique_suggested_words.filter(x => unique_words.indexOf(x) < 0 );
                            }
                            resolve({search_param: search_param, unique_words: unique_words, unique_suggested_words: unique_suggested_words});
                        } else {
                            unique_suggested_words = null;
                            resolve({search_param: search_param, unique_words: unique_words, unique_suggested_words: []});
                        }
                    });
                    // TODO: Ignore first word and pick stuff which are edit distance close, order them alphabetically
                });
            }).then(data => {
                resolve(data);
            }).catch(data => {
                if ("unique_words" in data) {
                    resolve({search_param: data.search_param, unique_words: data.unique_words, unique_suggested_words: []});
                }
                else {
                    reject({search_param: data.search_param, error: data.error});
                }
            });  
        }
        catch (e) {
            console.log(e);
            reject({search_param: search_param, error: e});
        }
    });
}

// Initialize the clustered worker process
// See: https://devcenter.heroku.com/articles/node-concurrency for more info
throng({ workers, start });
