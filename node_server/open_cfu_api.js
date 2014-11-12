var express = require('express');
var qs = require('querystring');
var fs = require('fs');
var r = require('rethinkdb');
var cors = require('cors');
var path = require('path');
var crypto = require('crypto');
var Promise = require('bluebird');
var exec = require('child_process').exec; 
var spawn = require('child_process').spawn; 
var app = express();
var csv = require('csv');
var _ = require('lodash');

var methodOverride = require('method-override');
var express     = require('express');
var errorHandler = require('errorhandler');

var bb = require('express-busboy');
bb.extend(app, {
	upload: true,
	path: 'upload_temp'
});

app.use(express.static(__dirname + '/uploads'));
app.use(cors());

var connection = null;
r.connect( {host: 'localhost', port: 28015, db: 'opencfu_plates'}, function(err, conn) {
	if (err) throw err;
	connection = conn;
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
	r.table('plates').run(connection)
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
	r.table('plates').get(request.params.token).run(connection)
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

app.post('/upload_plate', function (req, res) {
	var random_file_name = crypto.randomBytes(20).toString('hex');
	var token = crypto.randomBytes(20).toString('hex');
	var random_batch_id = crypto.randomBytes(20).toString('hex');

	console.log(req.files.file);

	var new_filename = random_file_name + path.extname(req.files.file.filename);

	var tempPath = req.files.file.file;

	targetPath = path.resolve('uploads/' + new_filename);
	fs.rename(tempPath, targetPath, function(err) {
		if (err){
			console.log("oh no!");
			res.writeHead(497, {'Content-Type': 'application/json'});
			res.end(JSON.stringify({'error': err}));

		} else {

			generate_img_upload_query(new_filename, token, {original_filename: req.files.file.filename}, random_batch_id).run(connection)
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

app.post('/save_colonies/:token', function(request, response) {
	console.log("hello!");
	var update_request = r.table('plates').get(request.params.token).update({colonies: request.body.colonies, clustering_params: request.body.clustering_params});

	update_request.run(connection)
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

//UPDATE: Don't actually save these to database, just return colonies... 
//only save classified colonies after annotation
//TODO Save param values here...
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
	r.table('plates').get(request.params.token).run(connection)
	.then(function(result) {
		var plate = result;

		//Run opencfu
		if (plate) {
			console.log(ocfu_command + ' uploads/' + plate.filename);

			var child = exec(ocfu_command + ' uploads/' + plate.filename, function (error, stdout, stderr) {
				if (error || stderr) {
					response.writeHead(497, {'Content-Type': 'application/json'});
					response.end(JSON.stringify({'error': 'opencfu threw an error, see stderr ' + error, 'stderr': stderr }));
				} else {
					console.log(stdout);
					csv.parse(stdout, function(err, data) {
						var ocfu_calls = csv_to_json(data);
						response.writeHead(200, {'Content-Type': 'application/json'});
						response.end(JSON.stringify(ocfu_calls));
					})

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

app.listen(3000);


