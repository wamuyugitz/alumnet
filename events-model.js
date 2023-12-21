const Datastore = require('nedb-promises');
const eventsDB = Datastore.create({ filename: 'databases/events.db', autoload: true });

module.exports = eventsDB;
