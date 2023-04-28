const startTransaction = async (db) => {
    return new Promise(function (resolve, reject) {
        db.run("BEGIN", (err, rows) => err ? reject(err) : resolve(rows));
    });
};

const endTransaction = async (db) => {
    return new Promise(function (resolve, reject) {
        db.run('commit', (err, rows) => err ? reject(err) : resolve(rows))
    });
};

module.exports = { startTransaction, endTransaction };