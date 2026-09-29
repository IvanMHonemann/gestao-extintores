CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`subscriptionId` int NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`status` enum('PENDING','PAID','FAILED','CANCELED','REFUNDED','OVERDUE') NOT NULL DEFAULT 'PENDING',
	`paymentMethod` varchar(80),
	`dueAt` timestamp,
	`paidAt` timestamp,
	`periodStart` timestamp,
	`periodEnd` timestamp,
	`provider` varchar(80),
	`providerPaymentId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`price` decimal(10,2) NOT NULL DEFAULT '0.00',
	`billingInterval` enum('MONTHLY','YEARLY') NOT NULL DEFAULT 'MONTHLY',
	`maxUsers` int,
	`maxClients` int,
	`maxExtinguishers` int,
	`features` text,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscription_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`subscriptionId` int NOT NULL,
	`eventType` varchar(80) NOT NULL,
	`source` varchar(80) NOT NULL,
	`referenceId` varchar(255),
	`payload` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `subscription_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscription_events_reference_unique` UNIQUE(`source`,`referenceId`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`planId` int NOT NULL,
	`status` enum('TRIAL','ACTIVE','PAST_DUE','GRACE_PERIOD','SUSPENDED','CANCELED','EXPIRED') NOT NULL DEFAULT 'TRIAL',
	`startsAt` timestamp NOT NULL,
	`currentPeriodStart` timestamp NOT NULL,
	`currentPeriodEnd` timestamp NOT NULL,
	`trialEndsAt` timestamp,
	`gracePeriodEndsAt` timestamp,
	`autoRenew` boolean NOT NULL DEFAULT false,
	`provider` varchar(80),
	`providerSubscriptionId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_subscriptionId_subscriptions_id_fk` FOREIGN KEY (`subscriptionId`) REFERENCES `subscriptions`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscription_events` ADD CONSTRAINT `subscription_events_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscription_events` ADD CONSTRAINT `subscription_events_subscriptionId_subscriptions_id_fk` FOREIGN KEY (`subscriptionId`) REFERENCES `subscriptions`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_planId_plans_id_fk` FOREIGN KEY (`planId`) REFERENCES `plans`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `payments_company_idx` ON `payments` (`companyId`);--> statement-breakpoint
CREATE INDEX `payments_subscription_idx` ON `payments` (`subscriptionId`);--> statement-breakpoint
CREATE INDEX `payments_status_idx` ON `payments` (`status`);--> statement-breakpoint
CREATE INDEX `payments_provider_idx` ON `payments` (`provider`,`providerPaymentId`);--> statement-breakpoint
CREATE INDEX `plans_active_idx` ON `plans` (`active`);--> statement-breakpoint
CREATE INDEX `subscription_events_company_idx` ON `subscription_events` (`companyId`);--> statement-breakpoint
CREATE INDEX `subscription_events_subscription_idx` ON `subscription_events` (`subscriptionId`);--> statement-breakpoint
CREATE INDEX `subscription_events_created_idx` ON `subscription_events` (`createdAt`);--> statement-breakpoint
CREATE INDEX `subscriptions_company_idx` ON `subscriptions` (`companyId`);--> statement-breakpoint
CREATE INDEX `subscriptions_status_idx` ON `subscriptions` (`status`);--> statement-breakpoint
CREATE INDEX `subscriptions_period_end_idx` ON `subscriptions` (`currentPeriodEnd`);--> statement-breakpoint
CREATE INDEX `subscriptions_provider_idx` ON `subscriptions` (`provider`,`providerSubscriptionId`);--> statement-breakpoint
