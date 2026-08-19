-- Grants every outstanding approval request.
--
-- Test-support only, used by workflow-smoke.ps1 to prove the transition gate releases
-- once sign-off exists. The real approve/reject endpoints belong to the Approval
-- Workflows task; until then this stands in for an approver's decision.
--
-- Runs as the schema owner, which is exempt from Row Level Security, so no tenant
-- context is needed.
UPDATE approval_request
SET status = 'APPROVED',
    "resolvedAt" = now(),
    "approvedCount" = "requiredCount"
WHERE status = 'PENDING';

SELECT count(*) AS approved_now FROM approval_request WHERE status = 'APPROVED';
