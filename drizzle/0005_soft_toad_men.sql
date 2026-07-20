CREATE TABLE `stripeEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` varchar(255) NOT NULL,
	`eventType` varchar(100) NOT NULL,
	`status` enum('processing','processed','failed') NOT NULL DEFAULT 'processing',
	`orderId` int,
	`attempts` int NOT NULL DEFAULT 1,
	`lastError` text,
	`processedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stripeEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `stripeEvents_eventId_unique` UNIQUE(`eventId`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `stripeCheckoutSessionId` varchar(255);--> statement-breakpoint
ALTER TABLE `orders` ADD `stripeCustomerId` varchar(255);--> statement-breakpoint
ALTER TABLE `orders` ADD `stripeSubscriptionId` varchar(255);--> statement-breakpoint
ALTER TABLE `orders` ADD `stripeSubscriptionStatus` varchar(32);--> statement-breakpoint
ALTER TABLE `orders` ADD `stripeLastCheckoutEventCreated` bigint unsigned;--> statement-breakpoint
ALTER TABLE `orders` ADD `stripeLastInvoiceEventCreated` bigint unsigned;--> statement-breakpoint
ALTER TABLE `orders` ADD `stripeLastSubscriptionEventCreated` bigint unsigned;--> statement-breakpoint
ALTER TABLE `orders` ADD `stripeTerminalAt` timestamp;--> statement-breakpoint
ALTER TABLE `orders` ADD `checkoutIdempotencyKey` varchar(128);--> statement-breakpoint
ALTER TABLE `orders` ADD `termsAcceptedAt` timestamp;--> statement-breakpoint
ALTER TABLE `orders` ADD `termsVersion` varchar(32);--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_userId_checkoutIdempotencyKey_uidx` UNIQUE(`userId`,`checkoutIdempotencyKey`);--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_stripeCheckoutSessionId_uidx` UNIQUE(`stripeCheckoutSessionId`);--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_stripeSubscriptionId_uidx` UNIQUE(`stripeSubscriptionId`);--> statement-breakpoint
CREATE INDEX `stripeEvents_orderId_idx` ON `stripeEvents` (`orderId`);--> statement-breakpoint
CREATE INDEX `stripeEvents_status_updatedAt_idx` ON `stripeEvents` (`status`,`updatedAt`);
