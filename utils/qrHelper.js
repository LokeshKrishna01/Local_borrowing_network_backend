const { v4: uuidv4 } = require('uuid');

const QR_EXPIRY_MINUTES = 10;

/**
 * Generate a unique QR secret with a 10-minute expiration.
 */
const generateQRSecret = () => {
  const secret = uuidv4();
  const expiresAt = new Date(Date.now() + QR_EXPIRY_MINUTES * 60 * 1000);
  return { secret, expiresAt };
};

/**
 * Validate a QR secret against a transaction's stored secret and expiry.
 */
const validateQRSecret = (inputSecret, transaction) => {
  if (!transaction.qrSecret || !transaction.qrExpiresAt) {
    return { valid: false, message: 'No QR code has been generated for this transaction' };
  }

  if (new Date() > new Date(transaction.qrExpiresAt)) {
    return { valid: false, message: 'QR code has expired. Please generate a new one.' };
  }

  if (inputSecret !== transaction.qrSecret) {
    return { valid: false, message: 'QR code does not match. Invalid return attempt.' };
  }

  return { valid: true, message: 'QR verified successfully' };
};

module.exports = { generateQRSecret, validateQRSecret };
