CREATE TABLE `providers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT false,
	`contactEmail` varchar(320),
	`website` varchar(500),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `providers_id` PRIMARY KEY(`id`),
	CONSTRAINT `providers_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
INSERT INTO `providers` (`name`, `slug`, `isActive`, `notes`)
SELECT
	'DatacenterMarket Partner Network',
	'datacentermarket-partner-network',
	false,
	'Migration placeholder for catalogue offers awaiting verified supplier attribution.'
WHERE NOT EXISTS (
	SELECT 1 FROM `providers` WHERE `slug` = 'datacentermarket-partner-network'
);--> statement-breakpoint
ALTER TABLE `offers`
	ADD `providerId` int,
	ADD `isActive` boolean DEFAULT false NOT NULL,
	ADD `availabilityStatus` enum('available','limited','unavailable','maintenance') DEFAULT 'unavailable' NOT NULL,
	ADD `availableCapacity` int DEFAULT 0 NOT NULL,
	ADD `availabilityUpdatedAt` timestamp DEFAULT (now()) NOT NULL,
	ADD `inventoryVersion` int DEFAULT 1 NOT NULL,
	ADD `availabilityExpiresAt` timestamp;--> statement-breakpoint
UPDATE `offers`
SET
	`providerId` = COALESCE(
		`providerId`,
		(SELECT `id` FROM `providers` WHERE `slug` = 'datacentermarket-partner-network' LIMIT 1)
	),
	`isActive` = false,
	`availabilityStatus` = 'unavailable',
	`availableCapacity` = 0,
	`availabilityUpdatedAt` = NOW(),
	`availabilityExpiresAt` = NULL;--> statement-breakpoint
ALTER TABLE `offers` ADD CONSTRAINT `offers_providerId_providers_id_fk` FOREIGN KEY (`providerId`) REFERENCES `providers`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `offers_providerId_idx` ON `offers` (`providerId`);--> statement-breakpoint
ALTER TABLE `orders` ADD `providerId` int;--> statement-breakpoint
UPDATE `orders` AS `orderRow`
LEFT JOIN `offers` AS `offerRow` ON `offerRow`.`id` = `orderRow`.`offerId`
SET `orderRow`.`providerId` = COALESCE(
	`offerRow`.`providerId`,
	(SELECT `id` FROM `providers` WHERE `slug` = 'datacentermarket-partner-network' LIMIT 1)
);--> statement-breakpoint
ALTER TABLE `orders` MODIFY COLUMN `providerId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_providerId_providers_id_fk` FOREIGN KEY (`providerId`) REFERENCES `providers`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `orders_providerId_idx` ON `orders` (`providerId`);
