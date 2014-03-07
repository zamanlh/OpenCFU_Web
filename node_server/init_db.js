var r = require('rethinkdb');

var connect = require('reql-then')
  , reql = connect({
      host: 'localhost',
      port: 28015,
      db: 'test',
      authKey: '',
      maxPoolSize: 10  // set to 1 to disable connection pooling
    });


var remove_old = r.dbDrop('opencfu_plates');
var create_db = r.dbCreate('opencfu_plates');
var create_table = r.db('opencfu_plates').tableCreate('plates', {primaryKey: "token"});


//Do this better!
reql(remove_old);
reql(create_db);
reql(create_table);
