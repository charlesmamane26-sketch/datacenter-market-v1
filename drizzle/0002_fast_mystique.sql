CREATE INDEX `infrastructureMetrics_orderId_recordedAt_idx` ON `infrastructureMetrics` (`orderId`,`recordedAt`);--> statement-breakpoint
CREATE INDEX `leads_userId_idx` ON `leads` (`userId`);--> statement-breakpoint
CREATE INDEX `orders_userId_createdAt_idx` ON `orders` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `orders_leadId_idx` ON `orders` (`leadId`);--> statement-breakpoint
CREATE INDEX `orders_offerId_idx` ON `orders` (`offerId`);--> statement-breakpoint
CREATE INDEX `provisioningEvents_orderId_idx` ON `provisioningEvents` (`orderId`);