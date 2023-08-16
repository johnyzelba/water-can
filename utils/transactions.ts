export const startTransaction = async (db) => {
    return new Promise(function (resolve, reject) {
        db.run("BEGIN", (err, rows) => err ? reject(err) : resolve(rows));
    });
};

export const endTransaction = async (db) => {
    return new Promise(function (resolve, reject) {
        db.run('COMMIT', (err, rows) => err ? reject(err) : resolve(rows))
    });
};

export const rollbackTransaction = async (db) => {
    return new Promise(function (resolve, reject) {
        db.run('ROLLBACK', (err, rows) => err ? reject(err) : resolve(rows))
    });
};
