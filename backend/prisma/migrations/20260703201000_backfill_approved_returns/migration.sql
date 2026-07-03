UPDATE "Order" AS orders
SET "fulfillmentStatus" = 'RETURNED'
WHERE orders."fulfillmentStatus" = 'DELIVERED'
  AND EXISTS (
    SELECT 1
    FROM "ReturnRequest" AS return_requests
    WHERE return_requests."orderId" = orders."id"
      AND return_requests."status" = 'APPROVED'
  );
