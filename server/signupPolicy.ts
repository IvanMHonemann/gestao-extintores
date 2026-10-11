const DISPOSABLE_DOMAINS = new Set([
  "10minutemail.com", "guerrillamail.com", "mailinator.com", "temp-mail.org", "tempmail.com", "yopmail.com", "sharklasers.com", "trashmail.com",
]);

export function normalizeSignupEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isDisposableEmail(email: string): boolean {
  const domain = normalizeSignupEmail(email).split("@").pop() || "";
  return DISPOSABLE_DOMAINS.has(domain.replace(/^\s+/, ""));
}
