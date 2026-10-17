import { PrismaClient } from "@prisma/client";
import { DEFAULT_DOC_CARDS } from "../src/lib/doc-cards";

async function main() {
  if (process.env.DIRECT_URL) {
    process.env.DATABASE_URL = process.env.DIRECT_URL;
  }
  const prisma = new PrismaClient();

  try {
    // Ubah enum → text (idempotent-ish)
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'player_documents'
            AND column_name = 'doc_type'
            AND udt_name = 'player_doc_type'
        ) THEN
          ALTER TABLE public.player_documents
            ALTER COLUMN doc_type TYPE text USING doc_type::text;
        END IF;
      END $$;
    `);

    await prisma.$executeRawUnsafe(`
      DROP TYPE IF EXISTS public.player_doc_type;
    `);

    console.log("OK: doc_type → text");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
