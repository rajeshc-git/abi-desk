export interface SnippetTemplate {
  id: string;
  name: string;
  category: 'Resolution' | 'Acknowledgment' | 'Follow-up' | 'Internal' | 'General' | 'Custom';
  description?: string;
  body: string;
  isDefault?: boolean;
  createdAt?: string;
}

export interface TicketSnippetContext {
  id?: string;
  number?: string | number;
  ticketNumber?: string | number;
  ticketNumberFormatted?: string;
  key?: string;
  displayId?: string;
  subject?: string;
  requester?: {
    fullName?: string;
    email?: string;
  };
  customer?: {
    fullName?: string;
    email?: string;
  };
  assignee?: {
    fullName?: string;
    email?: string;
  };
  status?: string;
  priority?: string;
  customFields?: Record<string, any>;
  [key: string]: any;
}

export const DEFAULT_SNIPPETS: SnippetTemplate[] = [
  {
    id: 'resolution-template',
    name: 'Resolution Template',
    category: 'Resolution',
    description: 'Notifies customer that the issue has been resolved and asks for validation.',
    isDefault: true,
    body: `Dear Team,

This message is regarding your Ticket ID \${Cases.Request Id}

We are changing the status of the concern raised in your request to 'Ready for confirmation'.
 
Request Reported: \${Cases.Subject}

Resolution Provided: The reported issue has been resolved, kindly check now and update.

Kindly validate the same and share your valuable feedback. Please get back to us for any further clarification. 
 
 
Thanks & Regards
\${Agent.Name}
Service Desk  

Email :servicedesk@attunelive.com

Toll free # : 04446313427`,
  },
  {
    id: 'acknowledgment-template',
    name: 'Acknowledgment Template',
    category: 'Acknowledgment',
    description: 'Confirms receipt of customer request and informs an executive is reviewing.',
    isDefault: true,
    body: `Dear Team,

Thanks for writing to us at Service Desk. We have received your request and processing it now. 

The reference ID for this case is \${Cases.Request Id}

A Service Desk Executive will be reviewing your request and will get back to you shortly.

 
Thanks & Regards
\${Agent.Name}
Service Desk  

Email :servicedesk@attunelive.com

Toll free # : 04446313427`,
  },
  {
    id: 'user-request-template',
    name: 'User Request Template',
    category: 'Resolution',
    description: 'Confirmation and validation request tailored to a specific user contact.',
    isDefault: true,
    body: `Dear \${Cases.Contact Name},

This message is regarding your Ticket ID \${Cases.Request Id}

We are changing the status of the concern raised in your request to 'Ready for confirmation'

Incident Reported: \${Cases.Subject}

Resolution Provided: The mentioned request has been done, kindly check.

This has been Requested from the User End.

Kindly validate the same and share your valuable feedback. Please get back to us for any further clarification.

 
Thanks & Regards
\${Agent.Name}
Service Desk  

Email :servicedesk@attunelive.com

Toll free # : 04446313427`,
  },
  {
    id: 'internal-acknowledgment',
    name: 'Internal Acknowledgment',
    category: 'Internal',
    description: 'Internal note recording the case reference ID.',
    isDefault: true,
    body: `Dear Team,

The reference ID for this case is \${Cases.Request Id}

 
Thanks & Regards
\${Agent.Name}
Service Desk  

Email :servicedesk@attunelive.com

Toll free # : 04446313427`,
  },
  {
    id: 'forwarding',
    name: 'Forwarding',
    category: 'General',
    description: 'Quick escalation or trail mail forwarding instruction note.',
    isDefault: true,
    body: `Dear Team,

Kindly check the trail mail and do the needful

Thanks & Regards
\${Agent.Name}
Service Desk  

Email :servicedesk@attunelive.com

Toll free # : 04446313427`,
  },
  {
    id: 'awaiting-customer-revert',
    name: 'Awaiting from Customer revert',
    category: 'Follow-up',
    description: 'Follow-up on inactive customer ticket and auto-closure notice.',
    isDefault: true,
    body: `Dear Team,

Hope you are doing well.

It has been quite some time since we've heard from you regarding ticket \${Cases.Request Id} which you have raised recently. This is just a follow-up for that ticket

So, we trust that your issue is not persisting or your ticket has been resolving, As of now we are updating the ticket status as Closed.

However, if you are in need of any further assistance, please do let us know by mail so that we could continue assisting you on this query. 
 
Thanks & Regards
\${Agent.Name}
Service Desk  

Email :servicedesk@attunelive.com

Toll free # : 04446313427`,
  },
];

const CUSTOM_SNIPPETS_KEY = 'abidesk_custom_snippets';

export function getCustomSnippets(): SnippetTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_SNIPPETS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveCustomSnippet(snippet: Omit<SnippetTemplate, 'id' | 'isDefault' | 'createdAt'> & { id?: string }): SnippetTemplate {
  const current = getCustomSnippets();
  if (snippet.id) {
    const updated = current.map((s) => (s.id === snippet.id ? { ...s, ...snippet } : s));
    localStorage.setItem(CUSTOM_SNIPPETS_KEY, JSON.stringify(updated));
    return { ...snippet, id: snippet.id, isDefault: false } as SnippetTemplate;
  } else {
    const newSnippet: SnippetTemplate = {
      ...snippet,
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      isDefault: false,
      createdAt: new Date().toISOString(),
    };
    current.push(newSnippet);
    localStorage.setItem(CUSTOM_SNIPPETS_KEY, JSON.stringify(current));
    return newSnippet;
  }
}

export function deleteCustomSnippet(id: string): void {
  const current = getCustomSnippets();
  const filtered = current.filter((s) => s.id !== id);
  localStorage.setItem(CUSTOM_SNIPPETS_KEY, JSON.stringify(filtered));
}

export function getAllSnippets(): SnippetTemplate[] {
  const custom = getCustomSnippets();
  return [...DEFAULT_SNIPPETS, ...custom];
}

export function resolveSnippetPlaceholders(
  templateBody: string,
  ticket?: TicketSnippetContext,
  currentUserName?: string,
): string {
  let text = templateBody;

  // Ticket ID / Reference Number (e.g. #ABI-6319 or #6319)
  const rawNum =
    ticket?.number ??
    ticket?.ticketNumber ??
    ticket?.ticketNumberFormatted ??
    ticket?.key ??
    ticket?.displayId;

  let ticketRef: string;
  if (rawNum !== undefined && rawNum !== null && String(rawNum).trim() !== '') {
    const s = String(rawNum).trim();
    ticketRef = s.startsWith('#') ? s : `#${s}`;
  } else if (ticket?.id) {
    ticketRef = `#${ticket.id.slice(0, 8).toUpperCase()}`;
  } else {
    ticketRef = '#TICKET';
  }

  // Ticket Subject
  const subject = ticket?.subject || 'Reported Request';

  // Contact / Requester Name
  const contactName =
    ticket?.requester?.fullName ||
    ticket?.customer?.fullName ||
    (ticket?.requester?.email ? ticket.requester.email.split('@')[0] : 'Team');

  // Agent Name
  const agentName = currentUserName || 'Service Desk';

  // Zoho Desk & Standard syntax replacements (case-insensitive & whitespace tolerant)
  text = text.replace(
    /\$\{(?:Cases\.(?:Request\s*Id|Ticket\s*(?:ID|Id|Number))|Ticket\.(?:Id|Number|Key)|ticket\.(?:id|number)|ticketNumber|ticketId)\}/gi,
    ticketRef,
  );
  text = text.replace(
    /\$\{(?:Cases\.Subject|Ticket\.Subject|ticket\.subject|subject)\}/gi,
    subject,
  );
  text = text.replace(
    /\$\{(?:Cases\.Contact\s*Name|Ticket\.Contact\s*Name|ticket\.contactName|contactName|customerName)\}/gi,
    contactName,
  );
  text = text.replace(
    /\$\{(?:Agent\.Name|agent\.name|agentName)\}/gi,
    agentName,
  );

  // Fallback for hardcoded agent name in user template text if needed
  if (currentUserName && currentUserName !== 'Eeshwar R S') {
    text = text.replace(/Eeshwar R S/g, currentUserName);
  }

  return text;
}
