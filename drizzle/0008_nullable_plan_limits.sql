-- Plan limits are nullable: NULL means unlimited. Legacy 999999 sentinels are normalized.
ALTER TABLE `plans`
  MODIFY COLUMN `maxUsers` int NULL DEFAULT NULL,
  MODIFY COLUMN `maxClients` int NULL DEFAULT NULL,
  MODIFY COLUMN `maxExtinguishers` int NULL DEFAULT NULL;

UPDATE `plans`
SET
  `maxUsers` = CASE WHEN `maxUsers` >= 999999 THEN NULL ELSE `maxUsers` END,
  `maxClients` = CASE WHEN `maxClients` >= 999999 THEN NULL ELSE `maxClients` END,
  `maxExtinguishers` = CASE WHEN `maxExtinguishers` >= 999999 THEN NULL ELSE `maxExtinguishers` END
WHERE `maxUsers` >= 999999
   OR `maxClients` >= 999999
   OR `maxExtinguishers` >= 999999;
