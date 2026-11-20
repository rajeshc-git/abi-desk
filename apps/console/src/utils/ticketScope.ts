/**
 * Helper to check if a ticket/event matches the user's product scope.
 * 
 * Rules:
 * 1. TENANT_ADMIN / PLATFORM_ADMIN see all workspace tickets.
 * 2. If an agent has no specific product scoping restrictions (empty products/productIds), they see all tickets.
 * 3. If a ticket is directly assigned to this agent, they can always see it.
 * 4. If an agent is restricted to specific products:
 *    - Matches if ticket customFields.product or ticket.product matches any of agent's assigned products.
 *    - Matches if ticket team.productId or ticket.productId matches any of agent's assigned product IDs.
 *    - Matches if any ticket tag matches the agent's assigned product names.
 *    - If ticket has no product specified at all, workspace support staff can see it.
 *    - Otherwise, if ticket belongs to a different product, returns false.
 */
export const isUserScopedToTicket = (ticket: any, user: any): boolean => {
  if (!user) return false;

  // 1. Check Admin Roles (supports string arrays and relation object arrays)
  const isTenantAdmin =
    user.isPlatformAdmin ||
    (Array.isArray(user.roles) &&
      user.roles.some((r: any) => {
        const key = typeof r === 'string' ? r : r?.role?.key || r?.key || r?.name;
        return key === 'TENANT_ADMIN' || key === 'PLATFORM_ADMIN';
      }));

  if (isTenantAdmin) return true; // Admins have full access across all products

  // 2. Extract allowed product names & IDs from user object (handling strings, IDs, relations)
  const userProducts: string[] = [];
  const userProductIds: string[] = [];

  if (Array.isArray(user.products)) {
    for (const p of user.products) {
      if (typeof p === 'string') {
        userProducts.push(p.toLowerCase().trim());
      } else if (p && typeof p === 'object') {
        if (p.productId) userProductIds.push(String(p.productId).toLowerCase().trim());
        if (p.product?.id) userProductIds.push(String(p.product.id).toLowerCase().trim());
        if (p.product?.name) userProducts.push(String(p.product.name).toLowerCase().trim());
        if (p.name) userProducts.push(String(p.name).toLowerCase().trim());
      }
    }
  }

  if (Array.isArray(user.productIds)) {
    for (const pid of user.productIds) {
      if (pid) userProductIds.push(String(pid).toLowerCase().trim());
    }
  }

  if (Array.isArray(user.productNames)) {
    for (const pn of user.productNames) {
      if (pn) userProducts.push(String(pn).toLowerCase().trim());
    }
  }

  // If agent has no specific product scoping restrictions, they can see all workspace tickets
  if (userProducts.length === 0 && userProductIds.length === 0) {
    return true;
  }

  // 3. Direct Assignment: If ticket is directly assigned to this agent, always allow
  if (ticket?.assigneeId && ticket.assigneeId === user.id) {
    return true;
  }
  if (ticket?.assignee?.id && ticket.assignee.id === user.id) {
    return true;
  }

  // 4. Extract product details from incoming ticket
  const ticketProdName = String(ticket?.customFields?.product || ticket?.product || '').toLowerCase().trim();
  const ticketProdId = String(ticket?.team?.productId || ticket?.productId || '').toLowerCase().trim();

  // Also extract tags
  const ticketTags = Array.isArray(ticket?.tags)
    ? ticket.tags
        .map((t: any) =>
          String(t?.tag?.name || t?.tag?.slug || t?.name || t?.slug || t || '')
            .toLowerCase()
            .trim(),
        )
        .filter(Boolean)
    : [];

  // If ticket has no product specified at all, workspace support staff can see it
  if (!ticketProdName && !ticketProdId && ticketTags.length === 0) {
    return true;
  }

  const matchesName = ticketProdName ? userProducts.includes(ticketProdName) : false;
  const matchesId = ticketProdId ? userProductIds.includes(ticketProdId) : false;
  const matchesTag = ticketTags.some((tag: string) => userProducts.includes(tag));

  if (ticketProdName || ticketProdId) {
    return matchesName || matchesId;
  }

  return matchesTag;
};
