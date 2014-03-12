var express = require('express');
var cors = require('cors')
var qs = require('querystring');
var fs = require('fs');
var r = require('rethinkdb');
var path = require('path');
var crypto = require('crypto');
var Promise = require("bluebird");
var exec = require('child_process').exec; 
var spawn = require('child_process').spawn; 
var app = express();
var csv = require('csv');
var _ = require('lodash');

app.use(cors());
app.use(app.router);


var connect = require('reql-then')
  , reql = connect({
      host: 'localhost',
      port: 28015,
      db: 'opencfu_plates',
      authKey: '',
      maxPoolSize: 10  // set to 1 to disable connection pooling
    });


//closure to generate reql query
var generate_img_upload_query = function(p_filename, p_token, desc_obj, batch_id) {
	return r.table('plates').insert([
		{ token: p_token, filename: p_filename, description: desc_obj, batch_id: 0, colonies: []} ]);
};

//assumes first entry is the header, true for opencfu
var csv_to_json = function(csv_data) {
	var header = csv_data.shift();
	var return_array = [];

	_.forEach(csv_data, function(row) {
		var row_obj = {};
		for (var i=0; i< row.length; i++){
			row_obj[header[i]] = parseFloat(row[i]);
		};
		return_array.push(row_obj);
	});

	return return_array;
};

app.get('/list_plates', function(request, response) {
	reql(r.table('plates'))
	.then(function(reql_res) {
		reql_res.toArray(function(err, result) {
			if(err) {
				//how to handle this case?
				response.writeHead(496, {'Content-Type': 'application/json'});
				response.end(JSON.stringify({'error': err}));
			}
			response.writeHead(200, {'Content-Type': 'application/json'});
			response.end(JSON.stringify(result));
		});
	}).error(function (err) {
		response.writeHead(496, {'Content-Type': 'application/json'});
		response.end(JSON.stringify({'error': 'database threw error, see dberror', dberror: err}));
	}).catch(function (err) {
		response.writeHead(496, {'Content-Type': 'application/json'});
		response.end(JSON.stringify({'error': 'database threw error, see dberror', dberror: err}));
	});

});

app.get('/get_plate/:token', function(request, response) {
	reql(r.table('plates').get(request.params.token))
	.then(function(reql_res) {
		response.writeHead(200, {'Content-Type': 'application/json'});
		response.end(JSON.stringify(reql_res));
	}).error(function (err) {
		response.writeHead(496, {'Content-Type': 'application/json'});
		response.end(JSON.stringify({'error': 'database threw error, see dberror', dberror: err}));
	}).catch(function (err) {
		response.writeHead(496, {'Content-Type': 'application/json'});
		response.end(JSON.stringify({'error': 'database threw error, see dberror', dberror: err}));
	});

});

app.post('/upload_plate', express.bodyParser({uploadDir:'upload_temp'}), function (req, res) {
	var random_file_name = crypto.randomBytes(20).toString('hex');
	var token = crypto.randomBytes(20).toString('hex');
	var random_batch_id = crypto.randomBytes(20).toString('hex');


	var new_filename = random_file_name + path.extname(req.files.file.name)

    var tempPath = req.files.file.path,

    targetPath = path.resolve('uploads/' + new_filename);
    fs.rename(tempPath, targetPath, function(err) {
        if (err){
        	console.log("oh no!");
        	res.writeHead(497, {'Content-Type': 'application/json'});
			res.end(JSON.stringify({'error': err}));

        } else {

			reql(generate_img_upload_query(new_filename, token, {original_filename: req.params.filename}, random_batch_id))
			.then(function (result) {
				res.writeHead(200, {'Content-Type': 'application/json'});
				res.end(JSON.stringify({'token': token}));

	        }).error(function (err) {
				res.writeHead(496, {'Content-Type': 'application/json'});
				res.end(JSON.stringify({'error': 'database threw error, see dberror', dberror: err}));
			}).catch(function (err) {
				res.writeHead(496, {'Content-Type': 'application/json'});
				res.end(JSON.stringify({'error': 'database threw error, see dberror', dberror: err}));
			});
    	}; 

    });

});

//TODO
app.post('/save_colonies/:token', function(request, response) {
	console.log(request.params);
});

//UPDATE: Don't actually save these to database, just return colonies... 
//only save classified colonies after annotation
app.get('/run_open_cfu/:token', function(request, response) {

	var query = request.url.split('?')[1];
	var ocfu_params = qs.parse(query);
	console.log(ocfu_params);

	var ocfu_command = 'opencfu -t3 -R25 -mauto -dbil -i';

	if (ocfu_params.slider_radius){
		ocfu_params.slider_radius = ocfu_params.slider_radius.split(',');

		ocfu_command = 'opencfu';
		ocfu_command += ' -r' + ocfu_params.slider_radius[0];
		ocfu_command += ' -R' + ocfu_params.slider_radius[1];
		ocfu_command += ' -d' + ocfu_params.threshold;
		ocfu_command += ' -t' + ocfu_params.slider_threshold;

		if (ocfu_params.auto_threshold) {
			ocfu_command += ' -a';
		};

		ocfu_command += ' -mauto';
		ocfu_command += ' -i';

	};

	var plates = null;
	//console.log(ocfu_params);

	//reql(r.table('plates').filter(r.row("token").eq(request.params.token)))
	reql(r.table('plates').get(request.params.token))
	.then(function(result) {
		var plate = result;

		//Run opencfu
		if (plate) {
			console.log(ocfu_command + ' uploads/' + plate.filename);

			var child = exec(ocfu_command + ' uploads/' + plate.filename, function (error, stdout, stderr) {
				if (error || stderr) {
					console.log("shit went down...");
					response.writeHead(497, {'Content-Type': 'application/json'});
					response.end(JSON.stringify({'error': 'opencfu threw an error, see stderr ' + error, 'stderr': stderr }));
				} else {
					csv().from.string(stdout, {comment: '#'})
					.to.array( function(data) {
						var ocfu_calls = csv_to_json(data);
						response.writeHead(200, {'Content-Type': 'application/json'});
						response.end(JSON.stringify(ocfu_calls));
					});

					child.on('close', function(code, signal) {
						console.log(code);
						console.log(signal);
					});		
				};
			});
		} else {
			response.writeHead(499, {'Content-Type': 'application/json'});
			response.end(JSON.stringify({'error': 'No plate found associated with token'}));
		}; 
	});
});

// Your own super cool function
var logger = function(req, res, next) {
    console.log("GOT REQUEST !");
    console.log(req.url);
    console.log(req.body);
    next(); // Passing the request to the next handler in the stack.
}
	
app.configure(function() {
	app.use(logger);
	app.use(express.json());
	app.use(express.urlencoded());	
	app.use(cors());
	app.use(app.router);
	app.use(express.json());
	app.use(express.urlencoded());
	app.use(express.methodOverride());
	app.use(express.static(__dirname + '/uploads'));
	app.use(express.errorHandler({
		dumpException: true,
		showStack: true
  	}));
});

app.listen(3000);


