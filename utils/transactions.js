const startTransaction = async (db) => {
    return new Promise(function (resolve, reject) {
        db.all("BEGIN", (err, rows) => err ? reject(err) : resolve(rows))
    });
};

const endTransaction = async (db) => {
    return new Promise(function (resolve, reject) {
        db.all("COMMIT", (err, rows) => err ? reject(err) : resolve(rows))
    });
};

module.exports = { startTransaction, endTransaction };