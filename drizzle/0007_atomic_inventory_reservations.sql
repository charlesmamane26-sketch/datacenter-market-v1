-- Fail before adding foreign keys when historical data contains orphans.
--
-- The guard relies on a PRIMARY KEY violation rather than a CHECK constraint so
-- that it fires on every MySQL-compatible engine. TiDB — the documented target
-- for this deployment — parses CHECK constraints but only enforces them from
-- v7.2 and only when `tidb_enable_check_constraint` is ON, which is not the
-- default: a CHECK-based guard would pass silently on orphaned rows and turn the
-- ALTER statements below into an opaque foreign-key error. A duplicate key is
-- refused unconditionally, on every engine and every sql_mode.
--
-- Each guard is a separate table named after the column it protects, so the
-- failure message ("Duplicate entry '0' for key '_m0007_orphan_orders_userId'")
-- says which foreign key has orphans. The seeded row collides with the row the
-- orphan probe inserts; a clean table inserts nothing and the migration proceeds.
CREATE TEMPORARY TABLE `_m0007_orphan_orders_userId` (`blocked` int NOT NULL, PRIMARY KEY (`blocked`));--> statement-breakpoint
INSERT INTO `_m0007_orphan_orders_userId` (`blocked`) VALUES (0);--> statement-breakpoint
INSERT INTO `_m0007_orphan_orders_userId` (`blocked`)
SELECT DISTINCT 0 FROM `orders` o LEFT JOIN `users` u ON u.`id` = o.`userId` WHERE u.`id` IS NULL;--> statement-breakpoint
CREATE TEMPORARY TABLE `_m0007_orphan_orders_leadId` (`blocked` int NOT NULL, PRIMARY KEY (`blocked`));--> statement-breakpoint
INSERT INTO `_m0007_orphan_orders_leadId` (`blocked`) VALUES (0);--> statement-breakpoint
INSERT INTO `_m0007_orphan_orders_leadId` (`blocked`)
SELECT DISTINCT 0 FROM `orders` o LEFT JOIN `leads` l ON l.`id` = o.`leadId` WHERE l.`id` IS NULL;--> statement-breakpoint
CREATE TEMPORARY TABLE `_m0007_orphan_orders_offerId` (`blocked` int NOT NULL, PRIMARY KEY (`blocked`));--> statement-breakpoint
INSERT INTO `_m0007_orphan_orders_offerId` (`blocked`) VALUES (0);--> statement-breakpoint
INSERT INTO `_m0007_orphan_orders_offerId` (`blocked`)
SELECT DISTINCT 0 FROM `orders` o LEFT JOIN `offers` f ON f.`id` = o.`offerId` WHERE f.`id` IS NULL;--> statement-breakpoint
DROP TEMPORARY TABLE `_m0007_orphan_orders_userId`;--> statement-breakpoint
DROP TEMPORARY TABLE `_m0007_orphan_orders_leadId`;--> statement-breakpoint
DROP TEMPORARY TABLE `_m0007_orphan_orders_offerId`;--> statement-breakpoint
ALTER TABLE `leads` ADD `personalDataErasedAt` timestamp;--> statement-breakpoint
ALTER TABLE `orders` ADD `inventoryReservedAt` timestamp;--> statement-breakpoint
ALTER TABLE `orders` ADD `inventoryReleasedAt` timestamp;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_leadId_leads_id_fk` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_offerId_offers_id_fk` FOREIGN KEY (`offerId`) REFERENCES `offers`(`id`) ON DELETE restrict ON UPDATE cascade;
