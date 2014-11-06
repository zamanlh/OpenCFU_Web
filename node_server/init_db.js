var r = require('rethinkdb');
var remove_old = r.dbDrop('opencfu_plates');
var create_db = r.dbCreate('opencfu_plates');
var create_table = r.db('opencfu_plates').tableCreate('plates', {primaryKey: "token"});


var connection = null;
r.connect({}, function(err, conn) {
    if (err) throw err;

	//Do this better!
	remove_old.run(conn);
	create_db.run(conn);
	create_table.run(conn);

});


