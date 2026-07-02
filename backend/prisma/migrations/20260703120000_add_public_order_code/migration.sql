-- Add a public, sequence-backed order identifier without deriving it from UUIDs.
CREATE SEQUENCE "Order_orderCode_seq"
    AS BIGINT
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE "Order" ADD COLUMN "orderCode" VARCHAR(16);

WITH numbered_orders AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) AS sequence_number
    FROM "Order"
)
UPDATE "Order" AS orders
SET "orderCode" = 'BK' || LPAD(numbered_orders.sequence_number::text, 6, '0')
FROM numbered_orders
WHERE orders."id" = numbered_orders."id";

SELECT setval(
    '"Order_orderCode_seq"'::regclass,
    COALESCE((SELECT COUNT(*) FROM "Order"), 0) + 1,
    false
);

ALTER TABLE "Order"
    ALTER COLUMN "orderCode" SET DEFAULT (
        'BK' || LPAD(nextval('"Order_orderCode_seq"'::regclass)::text, 6, '0')
    ),
    ALTER COLUMN "orderCode" SET NOT NULL,
    ADD CONSTRAINT "Order_orderCode_format_check"
        CHECK ("orderCode" ~ '^BK[0-9]{6,}$');

ALTER SEQUENCE "Order_orderCode_seq" OWNED BY "Order"."orderCode";

CREATE UNIQUE INDEX "Order_orderCode_key" ON "Order"("orderCode");

CREATE FUNCTION prevent_order_code_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW."orderCode" IS DISTINCT FROM OLD."orderCode" THEN
        RAISE EXCEPTION 'Order orderCode is immutable.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "Order_orderCode_immutable"
BEFORE UPDATE OF "orderCode" ON "Order"
FOR EACH ROW
EXECUTE FUNCTION prevent_order_code_update();
