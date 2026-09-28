export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.EXTERNAL_DATABASE_URL ?? process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  scheduleSecret: process.env.SCHEDULE_SECRET ?? "",
  alertWebhookUrl: process.env.ALERT_WEBHOOK_URL ?? "",
};
