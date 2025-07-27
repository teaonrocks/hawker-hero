const db = require("../config/database");

// Helper function to promisify db.query
const queryDB = (sql, params = []) => {
	return new Promise((resolve, reject) => {
		db.query(sql, params, (err, results) => {
			if (err) {
				return reject(err);
			}
			resolve(results);
		});
	});
};

module.exports = {
	queryDB,
};
