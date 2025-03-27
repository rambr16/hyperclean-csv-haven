
// Simple auth utility functions to supplement the AuthContext

/**
 * Validates if the email is in the correct format
 */
export const validateEmail = (email: string): boolean => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

/**
 * Validates if the password meets requirements
 * For this demo, we're just checking if it's not empty
 */
export const validatePassword = (password: string): boolean => {
  return password.length >= 8;
};

/**
 * Extracts domain from email address
 */
export const getDomainFromEmail = (email: string): string => {
  return email.split('@')[1];
};

/**
 * Checks if an email is a generic email (like info@, contact@, etc.)
 */
export const isGenericEmail = (email: string): boolean => {
  const genericPrefixes = ['info', 'contact', 'hello', 'support', 'admin', 'sales', 'marketing', 'help', 'service'];
  const prefix = email.split('@')[0].toLowerCase();
  return genericPrefixes.includes(prefix);
};
