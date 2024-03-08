const crypto = require('crypto');
const aes = require("aes-js");

function encryptState(data, key1, key2, key3) {
  //Step 1
  let hashEngine1 = crypto.createHash("sha256");
  let hashKey1 = hashEngine1.update(key1).digest();
  let bytes1 = aes.utils.utf8.toBytes(data);
  let aesCtr1 = new aes.ModeOfOperation.ctr(hashKey1);
  let encryptedData1 = aesCtr1.encrypt(bytes1);

  //Step 2
  let hashEngine2 = crypto.createHash("sha256");
  let hashKey2 = hashEngine2.update(key2).digest();
  let aesCtr2 = new aes.ModeOfOperation.ctr(hashKey2);
  let encryptedData2 = aesCtr2.encrypt(encryptedData1);

  //Step 3
  let hashEngine3 = crypto.createHash("sha256");
  let hashKey3 = hashEngine3.update(key3).digest();
  let aesCtr3 = new aes.ModeOfOperation.ctr(hashKey3);
  let encryptedData3 = aesCtr3.encrypt(encryptedData2);

  return aes.utils.hex.fromBytes(encryptedData3).padStart(32, '0');
}

function decryptState(data, key1, key2, key3) {
  //Step 1
  let hashEngine3 = crypto.createHash("sha256");
  let hashKey3 = hashEngine3.update(key3).digest();
  let encryptedBytes3 = aes.utils.hex.toBytes(data);
  let aesCtr3 = new aes.ModeOfOperation.ctr(hashKey3);
  let decryptedData3 = aesCtr3.decrypt(encryptedBytes3);

  //Step 2
  let hashEngine2 = crypto.createHash("sha256");
  let hashKey2 = hashEngine2.update(key2).digest();
  let aesCtr2 = new aes.ModeOfOperation.ctr(hashKey2);
  let decryptedData2 = aesCtr2.decrypt(decryptedData3);

  //Step 3
  let hashEngine1 = crypto.createHash("sha256");
  let hashKey1 = hashEngine1.update(key1).digest();
  let aesCtr1 = new aes.ModeOfOperation.ctr(hashKey1);
  let decryptedData1 = aesCtr1.decrypt(decryptedData2);

  return aes.utils.utf8.fromBytes(decryptedData1);
}

module.exports = {
  encryptState: encryptState,
  decryptState: decryptState
}
