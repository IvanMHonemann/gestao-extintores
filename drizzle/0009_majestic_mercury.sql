ALTER TABLE `subscription_events` DROP INDEX `subscription_events_reference_unique`;--> statement-breakpoint
ALTER TABLE `plans` MODIFY COLUMN `features` json;--> statement-breakpoint
ALTER TABLE `subscription_events` MODIFY COLUMN `source` enum('MANUAL','SYSTEM','GATEWAY') NOT NULL DEFAULT 'MANUAL';--> statement-breakpoint
ALTER TABLE `subscription_events` MODIFY COLUMN `referenceId` varchar(120);--> statement-breakpoint
ALTER TABLE `subscription_events` MODIFY COLUMN `payload` json;--> statement-breakpoint
ALTER TABLE `subscriptions` MODIFY COLUMN `status` enum('TRIAL','ACTIVE','PAST_DUE','GRACE_PERIOD','SUSPENDED','CANCELED','EXPIRED') NOT NULL DEFAULT 'ACTIVE';--> statement-breakpoint
ALTER TABLE `subscriptions` MODIFY COLUMN `autoRenew` boolean NOT NULL DEFAULT true;--> statement-breakpoint
ALTER TABLE `subscriptions` MODIFY COLUMN `provider` varchar(40) NOT NULL DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE `subscriptions` MODIFY COLUMN `providerSubscriptionId` varchar(120);--> statement-breakpoint
ALTER TABLE `subscription_events` ADD CONSTRAINT `subscription_events_reference_unique` UNIQUE(`referenceId`);