-- CreateTable: Ethiopian Intent Graph (Self-learning COSMO)
CREATE TABLE "intent_graph_entries" (
    "id"         TEXT NOT NULL,
    "query"      TEXT NOT NULL,
    "language"   TEXT NOT NULL DEFAULT 'am',
    "terms"      TEXT[],
    "intent"     TEXT NOT NULL,
    "boost"      INTEGER NOT NULL DEFAULT 8,
    "source"     TEXT NOT NULL DEFAULT 'ai',
    "useCount"   INTEGER NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "isActive"   BOOLEAN NOT NULL DEFAULT true,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intent_graph_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "intent_graph_entries_query_key" ON "intent_graph_entries"("query");
CREATE INDEX "intent_graph_entries_language_idx" ON "intent_graph_entries"("language");
CREATE INDEX "intent_graph_entries_intent_idx" ON "intent_graph_entries"("intent");
CREATE INDEX "intent_graph_entries_useCount_idx" ON "intent_graph_entries"("useCount");
