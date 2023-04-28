const startTransaction = async (db) => {
    return new Promise(function (resolve, reject) {
        db.begin((err, rows) => err ? reject(err) : resolve(rows));
    });
};

const endTransaction = async (db) => {
    return new Promise(function (resolve, reject) {
        db.commit((err, rows) => err ? reject(err) : resolve(rows))
    });
};

module.exports = { startTransaction, endTransaction };