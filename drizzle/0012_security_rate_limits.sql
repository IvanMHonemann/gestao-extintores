CREATE TABLE IF NOT EXISTS `security_rate_limits` (
  `rateKey` varchar(255) NOT NULL,
  `windowStart` bigint NOT NULL,
  `hitCount` int NOT NULL DEFAULT 0,
  `blockedUntil` bigint NOT NULL DEFAULT 0,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`rateKey`)
);

-- Rollback manual: DROP TABLE `security_rate_limits`;
