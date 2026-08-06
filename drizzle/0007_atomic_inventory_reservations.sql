-- Fail before adding foreign keys when historical data contains orphans.
-- MySQL reports the violated, deliberately descriptive CHECK constraint name.
CREATE TEMPORARY TABLE `_m0007_orders_fk_preflight` (
	`userOrphans` int NOT NULL,
	`leadOrphans` int NOT NULL,
	`offerOrphans` int NOT NULL,
	CONSTRAINT `m0007_no_orphan_orders_userId` CHECK (`userOrphans` = 0),
	CONSTRAINT `m0007_no_orphan_orders_leadId` CHECK (`leadOrphans` = 0),
	CONSTRAINT `m0007_no_orphan_orders_offerId` CHECK (`offerOrphans` = 0)
);--> statement-breakpoint
INSERT INTO `_m0007_orders_fk_preflight` (`userOrphans`, `leadOrphans`, `offerOrphans`)
SELECT
	(SELECT COUNT(*) FROM `orders` o LEFT JOIN `users` u ON u.`id` = o.`userId` WHERE u.`id` IS NULL),
	(SELECT COUNT(*) FROM `orders` o LEFT JOIN `leads` l ON l.`id` = o.`leadId` WHERE l.`id` IS NULL),
	(SELECT COUNT(*) FROM `orders` o LEFT JOIN `offers` f ON f.`id` = o.`offerId` WHERE f.`id` IS NULL);--> statement-breakpoint
DROP TEMPORARY TABLE `_m0007_orders_fk_preflight`;--> statement-breakpoint
ALTER TABLE `leads` ADD `personalDataErasedAt` timestamp;--> statement-breakpoint
ALTER TABLE `orders` ADD `inventoryReservedAt` timestamp;--> statement-breakpoint
ALTER TABLE `orders` ADD `inventoryReleasedAt` timestamp;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_leadId_leads_id_fk` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_offerId_offers_id_fk` FOREIGN KEY (`offerId`) REFERENCES `offers`(`id`) ON DELETE restrict ON UPDATE cascade;
