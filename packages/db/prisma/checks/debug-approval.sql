\echo '=== most recent approval requests ==='
SELECT ar.id,
       ar.status,
       ar."fromStatus",
       ar."toStatus",
       t.number,
       t.status AS ticket_status
FROM approval_request ar
JOIN ticket t ON t.id = ar."ticketId"
ORDER BY ar."createdAt" DESC
LIMIT 4;

\echo '=== ticket_event rows carrying an approvalRequestId ==='
SELECT type,
       metadata ->> 'approvalRequestId' AS approval_id,
       "createdAt"
FROM ticket_event
WHERE metadata ? 'approvalRequestId'
ORDER BY "createdAt" DESC
LIMIT 8;
