ALTER TABLE `member_accounts` ADD COLUMN `emailVerifiedAt` timestamp NULL;
ALTER TABLE `member_accounts` ADD COLUMN `emailVerificationTokenHash` varchar(64) NULL;
ALTER TABLE `member_accounts` ADD COLUMN `emailVerificationExpiresAt` timestamp NULL;
-- Contas existentes são consideradas confirmadas; novas contas recebem token.
UPDATE `member_accounts` SET `emailVerifiedAt` = COALESCE(`emailVerifiedAt`, `createdAt`) WHERE `emailVerifiedAt` IS NULL;
