const Datastore = require('nedb-promises');
// const { alumniDB } = require('./server');

const alumniDB = Datastore.create({ filename: 'alumni.db', autoload: true });

module.exports = alumniDB;
