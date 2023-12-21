const Datastore = require('nedb-promises');
const alumniDB = Datastore.create({ filename: 'alumni.db', autoload: true });

module.exports = alumniDB;
