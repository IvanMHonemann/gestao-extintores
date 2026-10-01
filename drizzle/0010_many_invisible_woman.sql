CREATE TABLE `company_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`planId` int NOT NULL,
	`status` enum('active','test','suspended','expired') NOT NULL DEFAULT 'active',
	`startsAt` date NOT NULL,
	`endsAt` date,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `company_subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscription_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`price` decimal(12,2) NOT NULL DEFAULT '0.00',
	`billingCycle` enum('monthly','yearly') NOT NULL DEFAULT 'monthly',
	`maxUsers` int,
	`maxClients` int,
	`maxExtinguishers` int,
	`featureDashboard` boolean NOT NULL DEFAULT false,
	`featureClients` boolean NOT NULL DEFAULT false,
	`featureExtinguishers` boolean NOT NULL DEFAULT false,
	`featureServiceOrders` boolean NOT NULL DEFAULT false,
	`featureAlerts` boolean NOT NULL DEFAULT false,
	`featureReports` boolean NOT NULL DEFAULT false,
	`featureUsers` boolean NOT NULL DEFAULT false,
	`featureBackup` boolean NOT NULL DEFAULT false,
	`featureOfflinePwa` boolean NOT NULL DEFAULT false,
	`availableForNew` boolean NOT NULL DEFAULT true,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscription_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `company_subscriptions` ADD CONSTRAINT `company_subscriptions_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `company_subscriptions` ADD CONSTRAINT `company_subscriptions_planId_subscription_plans_id_fk` FOREIGN KEY (`planId`) REFERENCES `subscription_plans`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `company_subscriptions_company_idx` ON `company_subscriptions` (`companyId`);--> statement-breakpoint
CREATE INDEX `company_subscriptions_plan_idx` ON `company_subscriptions` (`planId`);--> statement-breakpoint
CREATE INDEX `company_subscriptions_status_idx` ON `company_subscriptions` (`status`);--> statement-breakpoint
CREATE INDEX `company_subscriptions_ends_at_idx` ON `company_subscriptions` (`endsAt`);--> statement-breakpoint
CREATE INDEX `subscription_plans_name_idx` ON `subscription_plans` (`name`);--> statement-breakpoint
CREATE INDEX `subscription_plans_available_idx` ON `subscription_plans` (`availableForNew`,`active`);