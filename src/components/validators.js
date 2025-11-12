/**
 * Reusable validation functions for form inputs
 * Each function takes a value and returns true if valid, false if invalid
 */

// Email validation
export const validateEmail = (email) => {
  if (!email || typeof email !== "string") return true; // Allow empty values
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

// Phone number validation (allows numbers, spaces, hyphens, plus signs, parentheses)
export const validatePhone = (phone) => {
  if (!phone || typeof phone !== "string") return true; // Allow empty values
  const phoneRegex = /^[0-9\s\-\+\(\)]+$/;
  const numericDigits = phone.replace(/\D/g, "");
  return phoneRegex.test(phone) && numericDigits.length >= 8;
};

// Name validation (letters and spaces only)
export const validateName = (name) => {
  if (!name || typeof name !== "string") return true; // Allow empty values
  const nameRegex = /^[a-zA-Z\s]+$/;
  return nameRegex.test(name) && name.trim().length > 0;
};

// TFN validation (numbers only, minimum 8 digits)
export const validateTFN = (tfn) => {
  if (!tfn || typeof tfn !== "string") return true; // Allow empty values
  const tfnRegex = /^[0-9]+$/;
  return tfnRegex.test(tfn) && tfn.length >= 8;
};

// Emergency contact name validation (letters and spaces only)
export const validateEmergencyName = (name) => {
  if (!name || typeof name !== "string") return true; // Allow empty values
  const nameRegex = /^[a-zA-Z\s]+$/;
  return nameRegex.test(name) && name.trim().length > 0;
};

// Emergency contact phone validation (numbers only, minimum 8 digits)
export const validateEmergencyPhone = (phone) => {
  if (!phone || typeof phone !== "string") return true; // Allow empty values
  const phoneRegex = /^[0-9\s\-\+\(\)]+$/;
  const numericDigits = phone.replace(/\D/g, "");
  return phoneRegex.test(phone) && numericDigits.length >= 8;
};

// Bank account number validation (numbers and spaces only)
export const validateBankAccountNumber = (accountNumber) => {
  if (!accountNumber || typeof accountNumber !== "string") return true; // Allow empty values
  const accountRegex = /^[0-9\s]+$/;
  const numericDigits = accountNumber.replace(/\D/g, "");
  return accountRegex.test(accountNumber) && numericDigits.length >= 6;
};

// BSB validation (numbers only, exactly 6 digits)
export const validateBSB = (bsb) => {
  if (!bsb || typeof bsb !== "string") return true; // Allow empty values
  const bsbRegex = /^[0-9]+$/;
  return bsbRegex.test(bsb) && bsb.length === 6;
};

// Superannuation account number validation (numbers, hyphens, and spaces)
export const validateSuperAccountNumber = (accountNumber) => {
  if (!accountNumber || typeof accountNumber !== "string") return true; // Allow empty values
  const superRegex = /^[0-9\s\-]+$/;
  const numericDigits = accountNumber.replace(/\D/g, "");
  return superRegex.test(accountNumber) && numericDigits.length >= 6;
};

// Password validation (minimum 8 characters, at least one letter and one number)
export const validatePassword = (password) => {
  if (!password || typeof password !== "string") return true; // Allow empty values
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
  return passwordRegex.test(password);
};

// Date validation (YYYY-MM-DD format)
export const validateDate = (date) => {
  if (!date || typeof date !== "string") return true; // Allow empty values
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return false;

  const dateObj = new Date(date);
  return dateObj instanceof Date && !isNaN(dateObj);
};

// ABN validation (11 digits)
export const validateABN = (abn) => {
  if (!abn || typeof abn !== "string") return true; // Allow empty values
  const abnRegex = /^[0-9]{11}$/;
  return abnRegex.test(abn);
};

// Helper function to validate multiple fields at once
export const validateFields = (data, validators) => {
  const errors = [];

  Object.keys(validators).forEach((field) => {
    const value = data[field];
    const validator = validators[field];

    if (value && !validator(value)) {
      // Get error message from validator or use default
      const errorMessage = validator.errorMessage || `${field} is invalid`;
      errors.push(errorMessage);
    }
  });

  return errors;
};
