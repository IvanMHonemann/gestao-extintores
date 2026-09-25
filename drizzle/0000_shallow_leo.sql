CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`companyName` varchar(255) NOT NULL,
	`cnpj` varchar(30),
	`address` text,
	`city` varchar(120) NOT NULL,
	`cep` varchar(20),
	`phone` varchar(50),
	`contactName` varchar(255),
	`cpf` varchar(30),
	`birthDate` varchar(20),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `extinguishers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`clientId` int NOT NULL,
	`typeModel` varchar(100) NOT NULL,
	`capacity` varchar(50),
	`serialNumber` varchar(100),
	`locationInBuilding` varchar(200),
	`expirationDate` date NOT NULL,
	`lastInspectionDate` date,
	`status` enum('ok','warning','expired') NOT NULL DEFAULT 'ok',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `extinguishers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `member_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`userName` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`recoveryCodeHash` varchar(255),
	`role` enum('company_admin','operator','technician') NOT NULL DEFAULT 'operator',
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `member_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `member_accounts_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `member_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`memberAccountId` int NOT NULL,
	`tokenHash` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `member_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `member_sessions_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `platform_admins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userName` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`recoveryCodeHash` varchar(255),
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platform_admins_id` PRIMARY KEY(`id`),
	CONSTRAINT `platform_admins_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `platform_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`platformAdminId` int NOT NULL,
	`tokenHash` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `platform_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `platform_sessions_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `service_order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceOrderId` int NOT NULL,
	`description` varchar(255) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`unitPrice` decimal(10,2) NOT NULL DEFAULT '0.00',
	`totalPrice` decimal(10,2) NOT NULL DEFAULT '0.00',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `service_order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `service_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`orderNumber` int NOT NULL,
	`orderDate` date NOT NULL,
	`clientId` int NOT NULL,
	`replacedAndDelivered` varchar(10) DEFAULT 'SIM',
	`leftReserve` varchar(10) DEFAULT 'NÃO',
	`reserveDetails` varchar(255),
	`extinguisherExpiration` varchar(100),
	`licenseExpiration` varchar(100),
	`totalAmount` decimal(10,2) NOT NULL DEFAULT '0.00',
	`paymentMethod` varchar(50) DEFAULT 'A VISTA',
	`installmentsCount` int DEFAULT 1,
	`installmentDates` varchar(255),
	`responsibleName` varchar(255),
	`responsibleCpf` varchar(30),
	`responsibleBirthDate` varchar(20),
	`observations` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `service_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`settingKey` varchar(100) NOT NULL,
	`settingValue` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `system_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `system_settings_account_key_unique` UNIQUE(`accountId`,`settingKey`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('oauth_user','platform_admin') NOT NULL DEFAULT 'oauth_user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
ALTER TABLE `clients` ADD CONSTRAINT `clients_accountId_companies_id_fk` FOREIGN KEY (`accountId`) REFERENCES `companies`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `extinguishers` ADD CONSTRAINT `extinguishers_accountId_companies_id_fk` FOREIGN KEY (`accountId`) REFERENCES `companies`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `extinguishers` ADD CONSTRAINT `extinguishers_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `member_accounts` ADD CONSTRAINT `member_accounts_companyId_companies_id_fk` FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `member_sessions` ADD CONSTRAINT `member_sessions_memberAccountId_member_accounts_id_fk` FOREIGN KEY (`memberAccountId`) REFERENCES `member_accounts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `platform_sessions` ADD CONSTRAINT `platform_sessions_platformAdminId_platform_admins_id_fk` FOREIGN KEY (`platformAdminId`) REFERENCES `platform_admins`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_order_items` ADD CONSTRAINT `service_order_items_serviceOrderId_service_orders_id_fk` FOREIGN KEY (`serviceOrderId`) REFERENCES `service_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_orders` ADD CONSTRAINT `service_orders_accountId_companies_id_fk` FOREIGN KEY (`accountId`) REFERENCES `companies`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_orders` ADD CONSTRAINT `service_orders_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `system_settings` ADD CONSTRAINT `system_settings_accountId_companies_id_fk` FOREIGN KEY (`accountId`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `clients_account_idx` ON `clients` (`accountId`);--> statement-breakpoint
CREATE INDEX `clients_account_city_idx` ON `clients` (`accountId`,`city`);--> statement-breakpoint
CREATE INDEX `companies_active_idx` ON `companies` (`active`);--> statement-breakpoint
CREATE INDEX `companies_name_idx` ON `companies` (`name`);--> statement-breakpoint
CREATE INDEX `extinguishers_account_idx` ON `extinguishers` (`accountId`);--> statement-breakpoint
CREATE INDEX `extinguishers_client_idx` ON `extinguishers` (`clientId`);--> statement-breakpoint
CREATE INDEX `extinguishers_account_expiration_idx` ON `extinguishers` (`accountId`,`expirationDate`);--> statement-breakpoint
CREATE INDEX `member_accounts_company_idx` ON `member_accounts` (`companyId`);--> statement-breakpoint
CREATE INDEX `member_accounts_company_role_idx` ON `member_accounts` (`companyId`,`role`);--> statement-breakpoint
CREATE INDEX `member_sessions_account_expiry_idx` ON `member_sessions` (`memberAccountId`,`expiresAt`);--> statement-breakpoint
CREATE INDEX `platform_sessions_admin_expiry_idx` ON `platform_sessions` (`platformAdminId`,`expiresAt`);--> statement-breakpoint
CREATE INDEX `service_order_items_order_idx` ON `service_order_items` (`serviceOrderId`);--> statement-breakpoint
CREATE INDEX `service_orders_account_idx` ON `service_orders` (`accountId`);--> statement-breakpoint
CREATE INDEX `service_orders_client_idx` ON `service_orders` (`clientId`);--> statement-breakpoint
CREATE INDEX `service_orders_account_date_idx` ON `service_orders` (`accountId`,`orderDate`);--> statement-breakpoint
CREATE INDEX `service_orders_account_number_idx` ON `service_orders` (`accountId`,`orderNumber`);--> statement-breakpoint
CREATE INDEX `system_settings_account_idx` ON `system_settings` (`accountId`);