const Database = require('better-sqlite3');
const fs = require('fs');

if (!fs.existsSync(process.cwd() + '/Meta_Database')) {
    fs.mkdirSync(process.cwd() + '/Meta_Database');
    fs.writeFileSync(process.cwd() + '/Meta_Database/Do not delete this folder or any of the files in it', '', 'utf8');
}
var db = new Database(process.cwd() + "/Meta_Database/Database.sqlite");


db.exec("CREATE TABLE IF NOT EXISTS Meta (key TEXT, value TEXT)");

function setKeyValue(key, value) {
  const insertStatement = db.prepare("INSERT INTO Meta (key, value) VALUES (?, ?)");
  insertStatement.run(key, value);
}

function getKeyValue(key) {
  const selectStatement = db.prepare("SELECT value FROM Meta WHERE key = ?");
  const data = selectStatement.get(key);
  return data ? data.value : null;
}

function CreateJson(name, value) {
  if (!fs.existsSync(process.cwd() + '/Meta_Database/' + name)) {
    fs.writeFileSync(process.cwd() + '/Meta_Database/' + name, JSON.stringify(value, null, 2));
  }
}

function GetJson(name) {
  if (fs.existsSync(process.cwd() + '/Meta_Database/' + name)) {
    return JSON.parse(fs.readFileSync(process.cwd() + '/Meta_Database/' + name, 'utf-8'));
  }
}

module.exports = {
  setKeyValue,
  getKeyValue,
  CreateJson,
  GetJson
};
