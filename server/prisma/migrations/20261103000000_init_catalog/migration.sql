-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_lo" TEXT,
    "logo_url" TEXT,
    "website_url" TEXT,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" UUID,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "legacy_id" INTEGER,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT,
    "brand_id" TEXT,
    "category_id" UUID NOT NULL,
    "price_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "price_unit" TEXT,
    "min_order_quantity" INTEGER,
    "lead_time" TEXT,
    "short_description" TEXT,
    "description" TEXT,
    "specs" JSONB NOT NULL DEFAULT '[]',
    "options" JSONB NOT NULL DEFAULT '[]',
    "applications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "demo_options" BOOLEAN NOT NULL DEFAULT false,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "option_values" JSONB NOT NULL,
    "price_minor" BIGINT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "purchasable" BOOLEAN NOT NULL DEFAULT true,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "url" TEXT NOT NULL,
    "alt_text" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_legacy_id_key" ON "products"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_brand_id_idx" ON "products"("brand_id");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");

-- CreateIndex
CREATE INDEX "product_variants_product_id_idx" ON "product_variants"("product_id");

-- CreateIndex
CREATE INDEX "product_images_product_id_position_idx" ON "product_images"("product_id", "position");

-- CreateIndex
CREATE INDEX "product_images_variant_id_idx" ON "product_images"("variant_id");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data integrity checks (hand-written; Prisma does not model CHECK constraints).
ALTER TABLE "products" ADD CONSTRAINT "products_price_minor_nonnegative" CHECK ("price_minor" >= 0);
ALTER TABLE "products" ADD CONSTRAINT "products_currency_iso4217" CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "products" ADD CONSTRAINT "products_min_order_quantity_positive" CHECK ("min_order_quantity" IS NULL OR "min_order_quantity" > 0);
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_price_minor_nonnegative" CHECK ("price_minor" IS NULL OR "price_minor" >= 0);
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_position_nonnegative" CHECK ("position" >= 0);
ALTER TABLE "categories" ADD CONSTRAINT "categories_not_own_parent" CHECK ("parent_id" IS NULL OR "parent_id" <> "id");