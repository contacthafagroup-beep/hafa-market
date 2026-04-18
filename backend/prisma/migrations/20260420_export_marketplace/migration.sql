-- Export Marketplace Tables

-- Export product listings
CREATE TABLE IF NOT EXISTS "export_listings" (
  "id"                TEXT NOT NULL,
  "sellerId"          TEXT NOT NULL,
  "productId"         TEXT,
  "title"             TEXT NOT NULL,
  "titleAm"           TEXT,
  "description"       TEXT,
  "category"          TEXT NOT NULL,
  "origin"            TEXT,
  "grade"             TEXT,
  "moqQty"            DOUBLE PRECISION NOT NULL DEFAULT 100,
  "moqUnit"           TEXT NOT NULL DEFAULT 'kg',
  "pricePerUnit"      DOUBLE PRECISION NOT NULL,
  "currency"          TEXT NOT NULL DEFAULT 'USD',
  "priceTiers"        JSONB NOT NULL DEFAULT '[]',
  "certifications"    TEXT[] DEFAULT '{}',
  "processingMethod"  TEXT,
  "harvestSeason"     TEXT,
  "availableQty"      DOUBLE PRECISION,
  "leadTimeDays"      INTEGER NOT NULL DEFAULT 14,
  "incoterms"         TEXT NOT NULL DEFAULT 'FOB',
  "sampleAvailable"   BOOLEAN NOT NULL DEFAULT false,
  "samplePrice"       DOUBLE PRECISION,
  "images"            TEXT[] DEFAULT '{}',
  "videoUrl"          TEXT,
  "status"            TEXT NOT NULL DEFAULT 'ACTIVE',
  "views"             INTEGER NOT NULL DEFAULT 0,
  "inquiries"         INTEGER NOT NULL DEFAULT 0,
  "deals"             INTEGER NOT NULL DEFAULT 0,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "export_listings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "export_listings_sellerId_idx" ON "export_listings"("sellerId");
CREATE INDEX IF NOT EXISTS "export_listings_category_idx" ON "export_listings"("category");
CREATE INDEX IF NOT EXISTS "export_listings_status_idx" ON "export_listings"("status");

-- RFQ (Request for Quote) from buyers
CREATE TABLE IF NOT EXISTS "export_rfqs" (
  "id"            TEXT NOT NULL,
  "buyerId"       TEXT NOT NULL,
  "sellerId"      TEXT,
  "listingId"     TEXT,
  "buyerName"     TEXT NOT NULL,
  "buyerEmail"    TEXT NOT NULL,
  "buyerCountry"  TEXT NOT NULL,
  "buyerCompany"  TEXT,
  "message"       TEXT NOT NULL,
  "quantity"      DOUBLE PRECISION NOT NULL,
  "unit"          TEXT NOT NULL DEFAULT 'kg',
  "targetPrice"   DOUBLE PRECISION,
  "currency"      TEXT NOT NULL DEFAULT 'USD',
  "deliveryPort"  TEXT,
  "deliveryDate"  TIMESTAMP(3),
  "paymentTerms"  TEXT DEFAULT 'TT',
  "status"        TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "export_rfqs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "export_rfqs_buyerId_idx" ON "export_rfqs"("buyerId");
CREATE INDEX IF NOT EXISTS "export_rfqs_sellerId_idx" ON "export_rfqs"("sellerId");
CREATE INDEX IF NOT EXISTS "export_rfqs_listingId_idx" ON "export_rfqs"("listingId");
CREATE INDEX IF NOT EXISTS "export_rfqs_status_idx" ON "export_rfqs"("status");

-- Quotes (seller responds to RFQ)
CREATE TABLE IF NOT EXISTS "export_quotes" (
  "id"            TEXT NOT NULL,
  "rfqId"         TEXT NOT NULL,
  "sellerId"      TEXT NOT NULL,
  "buyerId"       TEXT NOT NULL,
  "unitPrice"     DOUBLE PRECISION NOT NULL,
  "quantity"      DOUBLE PRECISION NOT NULL,
  "unit"          TEXT NOT NULL DEFAULT 'kg',
  "totalAmount"   DOUBLE PRECISION NOT NULL,
  "currency"      TEXT NOT NULL DEFAULT 'USD',
  "incoterms"     TEXT NOT NULL DEFAULT 'FOB',
  "leadTimeDays"  INTEGER NOT NULL DEFAULT 14,
  "validUntil"    TIMESTAMP(3),
  "notes"         TEXT,
  "status"        TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "export_quotes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "export_quotes_rfqId_idx" ON "export_quotes"("rfqId");

-- Export orders (after quote accepted)
CREATE TABLE IF NOT EXISTS "export_orders" (
  "id"                    TEXT NOT NULL,
  "rfqId"                 TEXT,
  "quoteId"               TEXT,
  "buyerId"               TEXT NOT NULL,
  "sellerId"              TEXT NOT NULL,
  "listingId"             TEXT,
  "quantity"              DOUBLE PRECISION NOT NULL,
  "unit"                  TEXT NOT NULL DEFAULT 'kg',
  "unitPrice"             DOUBLE PRECISION NOT NULL,
  "totalAmount"           DOUBLE PRECISION NOT NULL,
  "currency"              TEXT NOT NULL DEFAULT 'USD',
  "depositAmount"         DOUBLE PRECISION,
  "depositPaid"           BOOLEAN NOT NULL DEFAULT false,
  "balanceAmount"         DOUBLE PRECISION,
  "balancePaid"           BOOLEAN NOT NULL DEFAULT false,
  "incoterms"             TEXT NOT NULL DEFAULT 'FOB',
  "deliveryPort"          TEXT,
  "status"                TEXT NOT NULL DEFAULT 'DEPOSIT_PENDING',
  "contractUrl"           TEXT,
  "billOfLadingUrl"       TEXT,
  "certificateOfOriginUrl" TEXT,
  "trackingNumber"        TEXT,
  "shippingLine"          TEXT,
  "etd"                   TIMESTAMP(3),
  "eta"                   TIMESTAMP(3),
  "escrowStatus"          TEXT NOT NULL DEFAULT 'PENDING',
  "notes"                 TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "export_orders_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "export_orders_buyerId_idx" ON "export_orders"("buyerId");
CREATE INDEX IF NOT EXISTS "export_orders_sellerId_idx" ON "export_orders"("sellerId");

-- Export negotiation messages
CREATE TABLE IF NOT EXISTS "export_messages" (
  "id"         TEXT NOT NULL,
  "rfqId"      TEXT NOT NULL,
  "senderId"   TEXT NOT NULL,
  "senderRole" TEXT NOT NULL DEFAULT 'BUYER',
  "senderName" TEXT NOT NULL,
  "type"       TEXT NOT NULL DEFAULT 'TEXT',
  "content"    TEXT,
  "fileUrl"    TEXT,
  "fileName"   TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "export_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "export_messages_rfqId_idx" ON "export_messages"("rfqId");
CREATE INDEX IF NOT EXISTS "export_messages_createdAt_idx" ON "export_messages"("createdAt");

-- Verified exporter profiles
CREATE TABLE IF NOT EXISTS "export_verifications" (
  "id"                  TEXT NOT NULL,
  "sellerId"            TEXT NOT NULL UNIQUE,
  "businessLicenseUrl"  TEXT,
  "exportLicenseUrl"    TEXT,
  "bankStatementUrl"    TEXT,
  "taxIdNumber"         TEXT,
  "annualExportVolume"  TEXT,
  "yearsExporting"      INTEGER,
  "certifications"      TEXT[] DEFAULT '{}',
  "status"              TEXT NOT NULL DEFAULT 'PENDING',
  "verifiedAt"          TIMESTAMP(3),
  "verifiedBy"          TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "export_verifications_pkey" PRIMARY KEY ("id")
);
