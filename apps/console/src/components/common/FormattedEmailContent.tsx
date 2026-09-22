import React, { useState, useMemo } from 'react';
import { MoreHorizontal, ExternalLink, Mail, Phone } from 'lucide-react';

interface FormattedEmailContentProps {
  text: string | null | undefined;
  className?: string;
  style?: React.CSSProperties;
}

// Regex for matching full URLs, www links, bare domains (.com, .in, .io, etc.), and email addresses
const DOMAIN_TLDS =
  'com|org|net|edu|gov|io|ai|co|in|dev|app|info|biz|me|cc|tv|uk|ca|de|us|fr|au|tech|online|store|site|agency|cloud|xyz';
const URL_OR_DOMAIN_REGEX = new RegExp(
  `(https?:\\/\\/[^\\s<>\"]+|(?:www\\.)?[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\\.(?:${DOMAIN_TLDS})(?::[0-9]{1,5})?(?:\\/[^\\s<>\"]*)?)`,
  'gi',
);
const EMAIL_REGEX = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
const CTA_KEYWORDS =
  /^(?:verify|confirm|reset|view|click here|sign in|log in|get started|download|pay|join|accept|approve|proceed|subscribe|unsubscribe|open|activate|register|check|visit|submit)/i;

/**
 * Universal Dynamic Email Parser:
 * Seamlessly handles:
 * 1. HTML Formatting (Gmail, Outlook, Apple Mail, Webmail, CRM systems)
 *    - <b>, <strong>, <span style="font-weight: bold"> -> Bold
 *    - <i>, <em>, <span style="font-style: italic"> -> Italics
 *    - <u>, <ins>, <span style="text-decoration: underline"> -> Underline
 *    - <del>, <s>, <strike> -> Strikethrough
 *    - <font color="...">, <span style="color: ..."> -> Colors
 *    - <a href="..."> -> Links & CTA Buttons
 *    - <img src="..."> -> Compact Inline Attachments & Signatures (no bloated spacing)
 *    - <h1>-<h6>, <ul>, <ol>, <li>, <blockquote>, <hr>, <pre>, <code>, <table>
 * 2. Plaintext & Markdown Formatting (Mobile Mail, Slack, Terminal)
 *    - *bold*, **bold**, _italics_, ~strike~, `code`, ```codeblocks```
 *    - Clickable URLs, domain links, and mailto/tel links
 * 3. Quoted Email Trails (Gmail / Outlook style collapse with "..." toggle)
 */
export const FormattedEmailContent: React.FC<FormattedEmailContentProps> = ({
  text,
  className,
  style,
}) => {
  if (!text) {
    return <span style={{ color: 'var(--text-muted, #64748b)', fontStyle: 'italic' }}>No content provided.</span>;
  }

  // Quick check for empty or placeholder content
  const cleanCheck = text
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim();

  if (
    !cleanCheck ||
    cleanCheck.toLowerCase() === '(no body)' ||
    cleanCheck.toLowerCase() === '(no description)' ||
    cleanCheck.toLowerCase() === 'no content provided.' ||
    cleanCheck.toLowerCase() === 'no content provided' ||
    cleanCheck.toLowerCase() === 'no text content provided.' ||
    cleanCheck.toLowerCase() === 'no text content provided'
  ) {
    return <span style={{ color: 'var(--text-muted, #64748b)', fontStyle: 'italic' }}>No content provided.</span>;
  }

  const isHtml = /<[a-z][\s\S]*>/i.test(text);

  if (isHtml) {
    return <HtmlEmailRenderer rawHtml={text} className={className} style={style} />;
  }

  return <PlaintextEmailRenderer rawText={text} className={className} style={style} />;
};

/* =========================================================================
   HTML EMAIL RENDERER (Native Browser DOM Parser + Sanitized React Elements)
   ========================================================================= */

interface HtmlEmailRendererProps {
  rawHtml: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Universal Email Parser & Sanitizer.
 *
 * Sanitizes raw HTML for safe dangerouslySetInnerHTML rendering while applying
 * the full universal email parser transformations:
 *
 * Security:
 *   - Strips script, style, iframe, object, embed, form, input, button tags
 *   - Removes on* event handlers and javascript: URIs
 *   - Forces links to target="_blank" rel="noopener noreferrer"
 *   - Hides 1×1 tracking pixels / web beacons
 *
 * Enhancement:
 *   - <a> with CTA keywords or button role/class → styled branded CTA button
 *   - <v:roundrect href="..."> (Outlook VML) → styled CTA button
 *   - Regular <a href="..."> → blue underlined link with ↗ external icon SVG
 *   - <img> → constrained max dimensions, signature logos capped smaller
 *   - Preserves ALL original inline styles, fonts, colors, margins exactly
 */
function sanitizeEmailHtml(raw: string): string {
  if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') {
    return raw.replace(/<[^>]*>/g, '');
  }

  // Pre-clean VML roundrect buttons (Outlook) before DOM parsing since DOMParser
  // doesn't understand VML namespace tags and would strip them.
  let preProcessed = raw;
  preProcessed = preProcessed.replace(
    /<v:roundrect[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/v:roundrect>/gi,
    (_match, href: string, content: string) => {
      const label = content.replace(/<[^>]*>/g, '').trim() || 'Click Here';
      return buildCtaButtonHtml(label, href.trim());
    },
  );

  const parser = new DOMParser();
  const doc = parser.parseFromString(preProcessed, 'text/html');

  // ── Security: Remove dangerous elements ──
  const dangerousTags = doc.querySelectorAll(
    'script, style, link, meta, title, head, iframe, object, embed, form, input, textarea, select',
  );
  dangerousTags.forEach((el) => el.remove());

  // Remove HTML comments
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_COMMENT);
  const comments: Comment[] = [];
  while (walker.nextNode()) {
    comments.push(walker.currentNode as Comment);
  }
  comments.forEach((c) => c.remove());

  // ── Security: Strip event handlers & javascript: URIs ──
  const allElements = doc.body.querySelectorAll('*');
  allElements.forEach((el) => {
    const attrs = Array.from(el.attributes);
    attrs.forEach((attr) => {
      if (/^on/i.test(attr.name) || attr.name === 'srcdoc' || attr.name === 'formaction') {
        el.removeAttribute(attr.name);
      }
      if (
        (attr.name === 'href' || attr.name === 'src' || attr.name === 'action') &&
        /^\s*javascript:/i.test(attr.value)
      ) {
        el.removeAttribute(attr.name);
      }
    });
  });

  // ── Enhancement: Transform <button> elements with href before removing ──
  doc.body.querySelectorAll('button').forEach((btn) => {
    const href = btn.getAttribute('href') || btn.closest('a')?.getAttribute('href');
    if (href) {
      const label = btn.textContent?.trim() || 'Click Here';
      const replacement = doc.createRange().createContextualFragment(buildCtaButtonHtml(label, href));
      btn.replaceWith(replacement);
    } else {
      btn.remove();
    }
  });

  // ── Enhancement: Transform <a> tags → CTA buttons or styled links ──
  const ctaKeywords = /^(?:verify|confirm|reset|view|click here|sign in|log in|get started|download|pay|join|accept|approve|proceed|subscribe|unsubscribe|open|activate|register|check|visit|submit)/i;

  doc.body.querySelectorAll('a').forEach((anchor) => {
    const href = anchor.getAttribute('href');
    if (!href) return;

    const safeHref = (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:') || href.startsWith('tel:'))
      ? href
      : `https://${href}`;

    const textContent = anchor.textContent?.trim() || '';
    const isButtonRole = anchor.getAttribute('role') === 'button';
    const isButtonClass = /(?:btn|button|cta|action)/i.test(anchor.className || '');
    const isButtonStyle = /(?:background|border-radius)/i.test(anchor.getAttribute('style') || '');
    const isCtaText = textContent.length > 0 && textContent.length <= 60 && ctaKeywords.test(textContent);

    if (isButtonRole || isButtonClass || isButtonStyle || isCtaText) {
      // Replace with styled CTA button
      const replacement = doc.createRange().createContextualFragment(
        buildCtaButtonHtml(textContent || 'Open Link', safeHref),
      );
      anchor.replaceWith(replacement);
    } else {
      // Style as regular link with external icon
      anchor.setAttribute('href', safeHref);
      anchor.setAttribute('target', '_blank');
      anchor.setAttribute('rel', 'noopener noreferrer');
      anchor.setAttribute('style',
        `color: #2563eb; font-weight: 600; text-decoration: underline; ${anchor.getAttribute('style') || ''}`,
      );

      // Append external link SVG icon if not already present
      if (!anchor.querySelector('.email-ext-icon')) {
        const icon = doc.createElement('span');
        icon.className = 'email-ext-icon';
        icon.setAttribute('style', 'display: inline-block; vertical-align: middle; margin-left: 2px; opacity: 0.8;');
        icon.innerHTML = EXTERNAL_LINK_SVG;
        anchor.appendChild(icon);
      }
    }
  });

  // ── Enhancement: Constrain <img> dimensions & remove tracking pixels ──
  doc.body.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') || '';
    const w = img.getAttribute('width');
    const h = img.getAttribute('height');

    // Remove tracking pixels
    if (
      w === '0' || h === '0' || w === '1' || h === '1' ||
      /1x1|track|beacon|open\.gif|pixel/i.test(src)
    ) {
      img.remove();
      return;
    }

    // Constrain oversized images
    const numW = w ? parseInt(w, 10) : NaN;
    const numH = h ? parseInt(h, 10) : NaN;

    const isSignature =
      /(?:logo|signature|icon|avatar|brand)/i.test(src) ||
      /(?:logo|signature|icon|avatar|brand)/i.test(img.getAttribute('alt') || '') ||
      Boolean(img.closest('.gmail_signature, [data-smartmail="gmail_signature"], #Signature, .signature'));

    const existingStyle = img.getAttribute('style') || '';
    let constraintStyle = 'max-width: 100%; height: auto; ';

    if (isSignature) {
      constraintStyle = `max-width: ${!isNaN(numW) ? Math.min(numW, 260) : 260}px; max-height: ${!isNaN(numH) ? Math.min(numH, 70) : 70}px; height: auto; object-fit: contain; `;
    } else if (!isNaN(numW) && numW > 600) {
      constraintStyle = `max-width: 100%; width: auto; height: auto; `;
    }

    img.setAttribute('style', constraintStyle + existingStyle);
    // Ensure broken images hide gracefully
    img.setAttribute('onerror', "this.style.display='none'");
  });

  return doc.body.innerHTML;
}

/** Inline SVG for the external-link icon (matches Lucide ExternalLink 11px) */
const EXTERNAL_LINK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;

/** Builds a styled CTA button as an HTML string */
function buildCtaButtonHtml(label: string, href: string): string {
  const safeHref = href.replace(/"/g, '&quot;');
  const safeLabel = label.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<span style="display: inline-block; margin: 4px 4px 4px 0; vertical-align: middle;">` +
    `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" ` +
    `style="display: inline-flex; align-items: center; justify-content: center; gap: 5px; ` +
    `padding: 6px 14px; background-color: #2563eb; color: #ffffff; font-size: 13px; ` +
    `font-weight: 600; text-decoration: none; border-radius: 6px; ` +
    `box-shadow: 0 1px 2px rgba(0,0,0,0.08); cursor: pointer; line-height: 1.4;">` +
    `<span>${safeLabel}</span>` +
    `<span style="display: inline-flex; opacity: 0.9;">${EXTERNAL_LINK_SVG.replace('width="11"', 'width="13"').replace('height="11"', 'height="13"')}</span>` +
    `</a></span>`;
}

const HtmlEmailRenderer: React.FC<HtmlEmailRendererProps> = ({ rawHtml, className, style }) => {
  const { primaryHtml, quotedHtml, hasQuoted } = useMemo(() => {
    try {
      if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') {
        return { primaryHtml: '', quotedHtml: '', hasQuoted: false };
      }

      const sanitized = sanitizeEmailHtml(rawHtml);
      const parser = new DOMParser();
      const doc = parser.parseFromString(sanitized, 'text/html');

      // Search for quoted email trail elements
      const quoteSelectors = [
        '.gmail_quote',
        '.gmail_extra',
        'blockquote.gmail_quote',
        '#divRplyFwdMsg',
        '[id^="divRplyFwdMsg"]',
        '.moz-cite-prefix',
        'blockquote[type="cite"]',
        '.email-quoted-reply',
      ];

      const quotedElements: Element[] = [];
      quoteSelectors.forEach((sel) => {
        doc.querySelectorAll(sel).forEach((el) => {
          if (!quotedElements.some((q) => q.contains(el))) {
            quotedElements.push(el);
          }
        });
      });

      // Also check block elements with "On ... wrote:" or "From: ..." etc.
      const blockElements = doc.querySelectorAll('div, p, blockquote');
      for (let i = 0; i < blockElements.length; i++) {
        const el = blockElements[i];
        if (!el || quotedElements.some((q) => q.contains(el))) continue;
        const textContent = el.textContent?.trim() || '';
        if (
          /^on\s.+wrote:?$/i.test(textContent) ||
          /^-+\s*(?:original message|forwarded message)\s*-+$/i.test(textContent) ||
          /^(?:from|sent|date):\s*.+/i.test(textContent)
        ) {
          quotedElements.push(el);
        }
      }

      let quotedHtml = '';
      if (quotedElements.length > 0) {
        const quotedContainer = document.createElement('div');
        quotedElements.forEach((el) => {
          quotedContainer.appendChild(el.cloneNode(true));
          el.remove();
        });
        quotedHtml = quotedContainer.innerHTML;
      }

      return {
        primaryHtml: doc.body.innerHTML.trim(),
        quotedHtml,
        hasQuoted: quotedHtml.length > 0,
      };
    } catch {
      return { primaryHtml: rawHtml, quotedHtml: '', hasQuoted: false };
    }
  }, [rawHtml]);

  const [isQuoteExpanded, setIsQuoteExpanded] = useState<boolean>(false);

  return (
    <div
      className={className}
      style={{
        width: '100%',
        wordBreak: 'break-word',
        fontSize: '13px',
        lineHeight: 1.4,
        color: 'var(--text-primary)',
        whiteSpace: 'normal',
        ...style,
      }}
    >
      {/* Primary Fresh Message — rendered with original email HTML/CSS intact */}
      {primaryHtml && (
        <>
          <style>{`
            .email-body-content ol {
              margin: 4px 0 6px 0;
              padding-left: 20px;
            }
            .email-body-content ul {
              margin: 4px 0 6px 0;
              padding-left: 20px;
            }
            .email-body-content li {
              margin-bottom: 2px;
              padding-left: 3px;
            }
            .email-body-content h3 {
              font-size: 14.5px;
              font-weight: 700;
              margin: 6px 0 2px 0;
              color: var(--text-primary);
            }
            .email-body-content p {
              margin: 2px 0;
            }
          `}</style>
          <div
            className="email-body-content"
            dangerouslySetInnerHTML={{ __html: primaryHtml }}
            style={{ overflowWrap: 'break-word', whiteSpace: 'normal' }}
          />
        </>
      )}

      {/* Quoted Trail (Gmail / Outlook style) */}
      {hasQuoted && (
        <div style={{ marginTop: '8px' }}>
          <button
            type="button"
            onClick={() => setIsQuoteExpanded(!isQuoteExpanded)}
            title={isQuoteExpanded ? 'Hide quoted text' : 'Show quoted text'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 9px',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--text-muted, #64748b)',
              backgroundColor: 'var(--bg-surface-elevated, #f1f5f9)',
              border: '1px solid var(--border-subtle, #cbd5e1)',
              borderRadius: '12px',
              cursor: 'pointer',
              marginBottom: isQuoteExpanded ? '6px' : '0',
              transition: 'all 0.15s ease',
            }}
          >
            <MoreHorizontal size={13} />
            <span>{isQuoteExpanded ? 'Hide quoted text' : 'Show quoted text'}</span>
          </button>

          {isQuoteExpanded && (
            <div
              style={{
                marginTop: '4px',
                paddingLeft: '12px',
                borderLeft: '3px solid var(--border-subtle, #cbd5e1)',
                color: 'var(--text-muted, #64748b)',
                fontSize: '13px',
                backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
                padding: '8px 12px',
                borderRadius: '0 6px 6px 0',
              }}
              dangerouslySetInnerHTML={{ __html: quotedHtml }}
            />
          )}
        </div>
      )}
    </div>
  );
};

/* =========================================================================
   PLAINTEXT & MARKDOWN EMAIL RENDERER
   ========================================================================= */

interface PlaintextEmailRendererProps {
  rawText: string;
  className?: string;
  style?: React.CSSProperties;
}

const PlaintextEmailRenderer: React.FC<PlaintextEmailRendererProps> = ({ rawText, className, style }) => {
  const { primaryText, quoteHeader, quotedLines } = parseEmailQuotation(rawText);
  const hasQuotedTrail = quotedLines.length > 0 || !!quoteHeader;
  const [isQuoteExpanded, setIsQuoteExpanded] = useState<boolean>(!primaryText.trim());

  return (
    <div
      className={className}
      style={{
        width: '100%',
        wordBreak: 'break-word',
        fontSize: '14px',
        lineHeight: 1.5,
        color: 'var(--text-primary)',
        ...style,
      }}
    >
      {/* Primary fresh message */}
      {primaryText.trim() && (
        <div style={{ marginBottom: hasQuotedTrail ? '8px' : '0' }}>
          {renderPlaintextBlocks(primaryText)}
        </div>
      )}

      {/* Quoted Trail */}
      {hasQuotedTrail && (
        <div style={{ marginTop: '6px' }}>
          {primaryText.trim() && (
            <button
              type="button"
              onClick={() => setIsQuoteExpanded(!isQuoteExpanded)}
              title={isQuoteExpanded ? 'Hide quoted text' : 'Show quoted text'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 9px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-muted, #64748b)',
                backgroundColor: 'var(--bg-surface-elevated, #f1f5f9)',
                border: '1px solid var(--border-subtle, #cbd5e1)',
                borderRadius: '12px',
                cursor: 'pointer',
                marginBottom: isQuoteExpanded ? '6px' : '0',
                transition: 'all 0.15s ease',
              }}
            >
              <MoreHorizontal size={13} />
              <span>{isQuoteExpanded ? 'Hide quoted text' : 'Show quoted text'}</span>
            </button>
          )}

          {isQuoteExpanded && (
            <div
              style={{
                marginTop: '4px',
                paddingLeft: '12px',
                borderLeft: '3px solid var(--border-subtle, #cbd5e1)',
                color: 'var(--text-muted, #64748b)',
                fontSize: '13px',
                backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
                padding: '8px 12px',
                borderRadius: '0 6px 6px 0',
              }}
            >
              {quoteHeader && (
                <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary, #475569)' }}>
                  {quoteHeader}
                </div>
              )}
              {renderQuotedLines(quotedLines)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function parseEmailQuotation(text: string) {
  const lines = text.split('\n');
  const primaryLines: string[] = [];
  const quotedLines: Array<{ level: number; text: string }> = [];
  let quoteHeader = '';
  let inQuote = false;

  const quoteHeaderPatterns = [
    /^on\s.+wrote:?$/i,
    /^-+\s*(?:original message|forwarded message)\s*-+$/i,
    /^from:\s*.+/i,
    /^sent:\s*.+/i,
    /^date:\s*.+/i,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (!inQuote) {
      const isQuoteHeader = quoteHeaderPatterns.some((pattern) => pattern.test(trimmed));
      if (isQuoteHeader) {
        inQuote = true;
        quoteHeader = trimmed;
        continue;
      }

      if (trimmed.startsWith('>')) {
        inQuote = true;
        const match = trimmed.match(/^(>+)\s*(.*)$/);
        if (match) {
          quotedLines.push({ level: match[1]!.length, text: match[2]! });
        }
        continue;
      }

      primaryLines.push(line);
    } else {
      if (trimmed.startsWith('>')) {
        const match = trimmed.match(/^(>+)\s*(.*)$/);
        if (match) {
          quotedLines.push({ level: match[1]!.length, text: match[2]! });
        }
      } else {
        quotedLines.push({ level: 1, text: line });
      }
    }
  }

  return {
    primaryText: primaryLines.join('\n'),
    quoteHeader,
    quotedLines,
  };
}

function renderPlaintextBlocks(text: string) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (!trimmed) {
      elements.push(<div key={i} style={{ height: '4px' }} />);
      continue;
    }

    if (trimmed === '---' || trimmed === '***' || trimmed === '___' || trimmed === '[HR]') {
      elements.push(
        <hr
          key={i}
          style={{
            border: 'none',
            borderTop: '1px solid var(--border-subtle, #e2e8f0)',
            margin: '8px 0',
          }}
        />,
      );
      continue;
    }

    if (trimmed.startsWith('# ') || trimmed.startsWith('[H1:')) {
      const content = trimmed.startsWith('# ') ? trimmed.slice(2) : trimmed.slice(4, -1);
      elements.push(
        <h2 key={i} style={{ fontSize: '18px', fontWeight: 700, margin: '10px 0 4px', color: 'var(--text-primary)' }}>
          {renderTextWithLinks(content, `h1-${i}`)}
        </h2>,
      );
      continue;
    }

    if (trimmed.startsWith('## ') || trimmed.startsWith('[H2:')) {
      const content = trimmed.startsWith('## ') ? trimmed.slice(3) : trimmed.slice(4, -1);
      elements.push(
        <h3 key={i} style={{ fontSize: '16px', fontWeight: 700, margin: '8px 0 3px', color: 'var(--text-primary)' }}>
          {renderTextWithLinks(content, `h2-${i}`)}
        </h3>,
      );
      continue;
    }

    if (trimmed.startsWith('### ') || trimmed.startsWith('[H3:') || trimmed.startsWith('[H4:')) {
      const content = trimmed.startsWith('### ') ? trimmed.slice(4) : trimmed.slice(4, -1);
      elements.push(
        <h4 key={i} style={{ fontSize: '14px', fontWeight: 700, margin: '6px 0 2px', color: 'var(--text-primary)' }}>
          {renderTextWithLinks(content, `h3-${i}`)}
        </h4>,
      );
      continue;
    }

    // Bullet list item
    if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const itemText = trimmed.replace(/^[•\-*]\s+/, '');
      elements.push(
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '6px',
            margin: '2px 0',
            paddingLeft: '4px',
          }}
        >
          <span style={{ color: 'var(--primary, #2563eb)', fontWeight: 700, lineHeight: 1.4 }}>•</span>
          <div style={{ flex: 1 }}>{renderTextWithLinks(itemText, `li-${i}`)}</div>
        </div>,
      );
      continue;
    }

    // Numbered list item
    const numberedMatch = trimmed.match(/^(\d+[\.\)])\s+(.*)$/);
    if (numberedMatch) {
      elements.push(
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '6px',
            margin: '2px 0',
            paddingLeft: '4px',
          }}
        >
          <span style={{ fontWeight: 600, color: 'var(--text-muted)', minWidth: '16px' }}>
            {numberedMatch[1]}
          </span>
          <div style={{ flex: 1 }}>{renderTextWithLinks(numberedMatch[2]!, `num-${i}`)}</div>
        </div>,
      );
      continue;
    }

    // Regular line
    elements.push(
      <div key={i} style={{ minHeight: '18px' }}>
        {renderTextWithLinks(line, `line-${i}`)}
      </div>,
    );
  }

  return <div>{elements}</div>;
}

function renderQuotedLines(lines: Array<{ level: number; text: string }>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      {lines.map((item, idx) => {
        if (!item.text.trim()) {
          return <div key={idx} style={{ height: '4px' }} />;
        }

        const isNested = item.level > 1;

        return (
          <div
            key={idx}
            style={{
              paddingLeft: isNested ? `${(item.level - 1) * 10}px` : '0px',
              borderLeft: isNested ? '2px solid var(--border-subtle, #cbd5e1)' : 'none',
              marginLeft: isNested ? '4px' : '0px',
              color: isNested ? 'var(--text-muted, #64748b)' : 'inherit',
            }}
          >
            {renderTextWithLinks(item.text, `qline-${idx}`)}
          </div>
        );
      })}
    </div>
  );
}

/* =========================================================================
   INLINE TOKEN & LINKIFIER PARSER
   ========================================================================= */

function renderTextWithLinks(text: string, keyPrefix: string): React.ReactNode {
  if (!text) return '';

  const tokenRegex = new RegExp(
    `\\[([^\\]\\n]+)\\]\\((https?:\\/\\/[^\\s\\)]+)\\)` +
    `|\\[BUTTON:([^|]+)\\|([^\\]]+)\\]` +
    `|\\[LINK:([^|]+)\\|([^\\]]+)\\]` +
    `|\\[IMG:([^\\]]+)\\]` +
    `|\\[BOLD:([\\s\\S]*?)\\]` +
    `|\\[ITALIC:([\\s\\S]*?)\\]` +
    `|\\[UNDERLINE:([\\s\\S]*?)\\]` +
    `|\\[STRIKE:([\\s\\S]*?)\\]` +
    `|\\[MARK:([\\s\\S]*?)\\]` +
    `|\\[CODE:([\\s\\S]*?)\\]` +
    `|\\*\\*([^\\*\\n]+)\\*\\*` +
    `|\\*([^\\*\\n]+)\\*` +
    `|_([^_\n]+)_` +
    `|~([^~\\n]+)~` +
    `|\`([^\`\\n]+)\`` +
    `|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})` +
    `|(https?:\\/\\/[^\\s<>\"]+|(?:www\\.)?[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\\.(?:${DOMAIN_TLDS})(?::[0-9]{1,5})?(?:\\/[^\\s<>\"]*)?)` +
    `|(mailto:[^\\s<>\"]+)` +
    `|(tel:[^\\s<>\"]+)`,
    'gi',
  );

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    const matchIndex = match.index;

    if (matchIndex > lastIndex) {
      parts.push(text.substring(lastIndex, matchIndex));
    }

    const [
      fullMatch,
      mdLabel,
      mdUrl,
      btnLabel,
      btnUrl,
      linkLabel,
      linkUrl,
      imgUrl,
      boldText,
      italicText,
      underlineText,
      strikeText,
      markText,
      codeText,
      mdBold2,
      mdBold1,
      mdItalic,
      mdStrike,
      mdCode,
      emailAddr,
      rawUrl,
      mailtoUrl,
      telUrl,
    ] = match;

    const matchKey = `${keyPrefix}-${matchIndex}`;

    if (mdUrl && mdLabel) {
      const isCta = mdLabel.length <= 50 && CTA_KEYWORDS.test(mdLabel);
      if (isCta) {
        parts.push(renderButton(btnLabel || mdLabel, mdUrl, matchKey));
      } else {
        parts.push(renderAnchor(mdLabel, mdUrl, matchKey));
      }
    } else if (btnUrl) {
      parts.push(renderButton(btnLabel || 'Open Link', btnUrl, matchKey));
    } else if (linkUrl) {
      parts.push(renderAnchor(linkLabel || linkUrl, linkUrl, matchKey));
    } else if (imgUrl) {
      parts.push(
        <img
          key={matchKey}
          src={imgUrl}
          alt="Inline Attachment"
          style={{
            maxWidth: '180px',
            maxHeight: '45px',
            objectFit: 'contain',
            display: 'inline-block',
            verticalAlign: 'middle',
            borderRadius: '4px',
            margin: '2px 0',
          }}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />,
      );
    } else if (boldText || mdBold2 || mdBold1) {
      const content = boldText || mdBold2 || mdBold1 || '';
      parts.push(
        <strong key={matchKey} style={{ fontWeight: 700 }}>
          {renderTextWithLinks(content, `${matchKey}-b`)}
        </strong>,
      );
    } else if (italicText || mdItalic) {
      const content = italicText || mdItalic || '';
      parts.push(
        <em key={matchKey} style={{ fontStyle: 'italic' }}>
          {renderTextWithLinks(content, `${matchKey}-i`)}
        </em>,
      );
    } else if (underlineText) {
      parts.push(
        <u key={matchKey} style={{ textDecoration: 'underline' }}>
          {renderTextWithLinks(underlineText, `${matchKey}-u`)}
        </u>,
      );
    } else if (strikeText || mdStrike) {
      const content = strikeText || mdStrike || '';
      parts.push(
        <del key={matchKey} style={{ textDecoration: 'line-through', opacity: 0.75 }}>
          {renderTextWithLinks(content, `${matchKey}-s`)}
        </del>,
      );
    } else if (markText) {
      parts.push(
        <mark
          key={matchKey}
          style={{
            backgroundColor: '#fef08a',
            color: '#713f12',
            padding: '1px 4px',
            borderRadius: '3px',
          }}
        >
          {markText}
        </mark>,
      );
    } else if (codeText || mdCode) {
      const content = codeText || mdCode || '';
      parts.push(
        <code
          key={matchKey}
          style={{
            backgroundColor: 'var(--bg-surface-elevated, #f1f5f9)',
            border: '1px solid var(--border-subtle, #e2e8f0)',
            padding: '1px 4px',
            borderRadius: '3px',
            fontSize: '12px',
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            color: 'var(--text-primary)',
          }}
        >
          {content}
        </code>,
      );
    } else if (emailAddr) {
      parts.push(
        <a
          key={matchKey}
          href={`mailto:${emailAddr}`}
          style={{
            color: 'var(--primary, #2563eb)',
            textDecoration: 'underline',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '2px',
          }}
        >
          <Mail size={12} />
          <span>{emailAddr}</span>
        </a>,
      );
    } else if (mailtoUrl) {
      parts.push(
        <a
          key={matchKey}
          href={mailtoUrl}
          style={{
            color: 'var(--primary, #2563eb)',
            textDecoration: 'underline',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '2px',
          }}
        >
          <Mail size={12} />
          <span>{mailtoUrl.replace('mailto:', '')}</span>
        </a>,
      );
    } else if (telUrl) {
      parts.push(
        <a
          key={matchKey}
          href={telUrl}
          style={{
            color: 'var(--primary, #2563eb)',
            textDecoration: 'underline',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '2px',
          }}
        >
          <Phone size={12} />
          <span>{telUrl.replace('tel:', '')}</span>
        </a>,
      );
    } else if (rawUrl) {
      const destination = rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
        ? rawUrl
        : `https://${rawUrl}`;

      parts.push(
        <a
          key={matchKey}
          href={destination}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'var(--primary, #2563eb)',
            textDecoration: 'underline',
            wordBreak: 'break-all',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '2px',
          }}
        >
          <span>{rawUrl}</span>
          <ExternalLink size={11} style={{ opacity: 0.8 }} />
        </a>,
      );
    }

    lastIndex = matchIndex + fullMatch.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

function renderButton(label: string, url: string, key: string) {
  const destination =
    url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:') || url.startsWith('tel:')
      ? url
      : `https://${url}`;

  return (
    <span key={key} style={{ display: 'inline-block', margin: '4px 4px 4px 0', verticalAlign: 'middle' }}>
      <a
        href={destination}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '5px',
          padding: '5px 12px',
          backgroundColor: 'var(--primary, #2563eb)',
          color: '#ffffff',
          fontSize: '12px',
          fontWeight: 600,
          textDecoration: 'none',
          borderRadius: '5px',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          lineHeight: 1.3,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--primary-hover, #1d4ed8)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--primary, #2563eb)';
        }}
      >
        <span>{label}</span>
        <ExternalLink size={12} style={{ opacity: 0.9 }} />
      </a>
    </span>
  );
}

function renderAnchor(label: string, url: string, key: string) {
  const destination =
    url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;

  return (
    <a
      key={key}
      href={destination}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: 'var(--primary, #2563eb)',
        fontWeight: 600,
        textDecoration: 'underline',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '2px',
      }}
    >
      <span>{label}</span>
      <ExternalLink size={11} style={{ opacity: 0.8 }} />
    </a>
  );
}
