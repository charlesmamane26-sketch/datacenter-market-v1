CREATE TABLE `infrastructureMetrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`gpuUsagePercent` decimal(5,2),
	`gpuMemoryUsedGb` decimal(10,2),
	`gpuMemoryTotalGb` int,
	`cpuUsagePercent` decimal(5,2),
	`ramUsedGb` decimal(10,2),
	`ramTotalGb` int,
	`costThisMonth` decimal(12,2),
	`costProjected` decimal(12,2),
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `infrastructureMetrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`email` varchar(320) NOT NULL,
	`company` varchar(255),
	`contactName` varchar(255),
	`contactRole` varchar(255),
	`workloadType` varchar(100),
	`gpuRequirement` varchar(100),
	`monthlyBudget` decimal(12,2),
	`deploymentDuration` varchar(100),
	`infrastructureConstraints` text,
	`status` enum('new','qualified','offered','converted','rejected') NOT NULL DEFAULT 'new',
	`selectedOfferId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `offers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`category` enum('best_value','fastest','cheapest') NOT NULL,
	`gpuType` varchar(100) NOT NULL,
	`gpuCount` int NOT NULL,
	`cpuCores` int NOT NULL,
	`ramGb` int NOT NULL,
	`storageGb` int NOT NULL,
	`location` varchar(100) NOT NULL,
	`monthlyPrice` decimal(12,2) NOT NULL,
	`setupFee` decimal(12,2) DEFAULT '0',
	`sla` varchar(50) NOT NULL,
	`deploymentTime` varchar(100) NOT NULL,
	`description` text,
	`features` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `offers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`leadId` int NOT NULL,
	`offerId` int NOT NULL,
	`status` enum('pending','processing','provisioning','active','cancelled','completed') NOT NULL DEFAULT 'pending',
	`totalAmount` decimal(12,2) NOT NULL,
	`setupFee` decimal(12,2) DEFAULT '0',
	`monthlyRecurring` decimal(12,2) NOT NULL,
	`stripePaymentIntentId` varchar(255),
	`paymentStatus` enum('pending','succeeded','failed','cancelled') NOT NULL DEFAULT 'pending',
	`provisioningStartedAt` timestamp,
	`provisioningCompletedAt` timestamp,
	`contractUrl` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `provisioningEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`eventType` enum('order_received','provider_matching','contract_generation','provisioning','ready') NOT NULL,
	`status` enum('pending','in_progress','completed','failed') NOT NULL DEFAULT 'pending',
	`description` text,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `provisioningEvents_id` PRIMARY KEY(`id`)
);
