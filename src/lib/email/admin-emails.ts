/**
 * Parse comma-separated admin emails from environment variable
 * Supports both ADMIN_EMAIL (single) and ADMIN_EMAILS (multiple)
 */
export function getAdminEmails(): string[] {
  const emailsString =
    process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "";

  if (!emailsString) {
    console.warn("No admin emails configured in ADMIN_EMAILS or ADMIN_EMAIL");
    return [];
  }

  return emailsString
    .split(",")
    .map((email) => email.trim())
    .filter((email) => email.length > 0);
}

/**
 * Validate if email format is correct
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Get validated admin emails
 */
export function getValidAdminEmails(): string[] {
  return getAdminEmails().filter(isValidEmail);
}
