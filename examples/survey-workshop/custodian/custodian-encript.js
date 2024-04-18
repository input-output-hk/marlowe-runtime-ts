/**
 * This file has some basic encryption and decryption functions to
 * communicate between a survey participant and the token custodian.
 */

// This is the custodian Public Key
const custodianPubkey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyTHkM+HNQ7M+T2bEW9cq
kdjQ49AYY/M4+q1LawK0EheeFX3OxW97muysn/kWuIrF4gcCQVB5Fuiys43LbHmv
0hzrJNmure1C2T0yFW56MO4kv5n/LHYYZttyHdTbQS0og/XaO5VhtvdzuIFnCaf+
64zIWYnzLs/zSwCbX6iORXxdMF7C6h8QOtNZuLVXwgBJsvZfNhN4kyfYLA+EyJJ6
2hUdpHDA2/qQ1ydk2wYHy9oj9xMQ6hUz2DvmsqqONtk15uNWy2zGxlBTQeImuZ72
0HvUBeh9mQcFjTHdPysL96Ty0XZINQ29izJqOi13JQV0eY+V/9RZn81lFAtGJhAC
XQIDAQAB
-----END PUBLIC KEY-----
`;

export async function encryptMessage(message) {
  var encrypt = new JSEncrypt();
  encrypt.setPublicKey(custodianPubkey);
  var encrypted = encrypt.encrypt(message);

  const chunks = encrypted.match(/.{1,64}/g).reduce((obj, chunk, index) => {
    obj[index] = chunk;
    return obj;
  }, {});

  const hash = await digestMessage(message);
  const lastDigits = hash.slice(-10);
  const lastDigitsDecimal = BigInt(`0x${lastDigits}`);

  return {
    encrypted,
    chunks,
    hash,
    lastDigits,
    lastDigitsDecimal,
  };
}

/**
 * Computes the SHA-256 hash of the given message. Returns it as a hex string.
 */
async function digestMessage(message) {
  const msgUint8 = new TextEncoder().encode(message); // encode as (utf-8) Uint8Array
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8); // hash the message
  const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join(""); // convert bytes to hex string
  return hashHex;
}

export function setPrivateKey(privateKey) {
  localStorage.setItem("custodianPrivateKey", privateKey);
}

export async function decryptChunks(chunks) {
  const privateKey = localStorage.getItem("custodianPrivateKey");
  if (!privateKey) {
    throw new Error("Private key expected on local storage as custodianPrivateKey");
  }
  const encrypted = Object.entries(chunks)
    .sort((a, b) => a[0] - b[0])
    .reduce((acc, [key, value]) => acc + value, "");
  const decrypt = new JSEncrypt();
  decrypt.setPrivateKey(privateKey);
  const decrypted = decrypt.decrypt(encrypted);

  const hash = await digestMessage(decrypted);
  const lastDigits = hash.slice(-10);
  const lastDigitsDecimal = BigInt(`0x${lastDigits}`);

  return { encrypted, decrypted, hash, lastDigits, lastDigitsDecimal };
}
