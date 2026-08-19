import React, { useState } from 'react';
import { MoreHorizontal, ExternalLink, Mail, Phone } from 'lucide-react';

interface FormattedEmailContentProps {
  text: string | null | undefined;
  className?: string;
  style?: React.CSSProperties;
}

// Regex for matching full URLs, www links, bare domains (.com, .in, .io, etc.), and email addresses
const DOMAIN_TLDS = 'com|org|net|edu|gov|io|ai|co|in|dev|app|info|biz|me|cc|tv|uk|ca|de|us|fr|au|tech|online|store|site|agency|cloud|xyz';
const URL_OR_DOMAIN_REGEX = new RegExp(
  `(https?:\\/\\/[^\\s<>\"]+|(?:www\\.)?[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\\.(?:${DOMAIN_TLDS})(?::[0-9]{1,5})?(?:\\/[^\\s<>\"]*)?)`,
  'gi',
);
const EMAIL_REGEX = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;

/**
 * Universal Dynamic Email Parser:
 * Dynamically handles BOTH:
 * 1. HTML Formatting (from Outlook, Apple Mail, Webmail):
 *    - <b>, <strong>, <span style="font-weight: bold"> -> Bold
 *    - <i>, <em>, <span style="font-style: italic"> -> Italics
 *    - <u>, <ins>, <span style="text-decoration: underline"> -> Underline
 *    - <del>, <s>, <strike> -> Strikethrough
 *    - <h1> - <h6> -> Headings
 *    - <ul>, <ol>, <li> -> Bullet / Numbered lists
 * 2. Markdown & Plaintext Formatting (from Gmail, Slack, Mobile mail):
 *    - *bold*, **bold** -> Bold
 *    - _italics_ -> Italics
 *    - ~strike~ -> Strikethrough
 *    - `code`, ```codeblocks``` -> Code
 *    - Bare domains (abc.com, google.in, www.site.io) -> Clickable links
 *    - Email addresses -> Clickable mailto links
 */
export const FormattedEmailContent: React.FC<FormattedEmailContentProps> = ({
  text,
  className,
  style,
}) => {
  if (!text) {
    return <span style={{ color: 'var(--text-muted, #64748b)', fontStyle: 'italic' }}>No content provided.</span>;
  }

  // Check if string contains actual readable content
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

  // Pre-process HTML & Markdown safely
  const normalized = normalizeEmailHtml(text);

  // Split content into primary fresh message and quoted reply trail
  const { primaryText, quoteHeader, quotedLines } = parseEmailQuotation(normalized);
  const hasQuotedTrail = quotedLines.length > 0 || !!quoteHeader;

  // If there's primary text, collapse the quote by default (like Gmail).
  const [isQuoteExpanded, setIsQuoteExpanded] = useState<boolean>(!primaryText.trim());

  return (
    <div
      className={className}
      style={{
        width: '100%',
        wordBreak: 'break-word',
        fontSize: '14px',
        lineHeight: 1.6,
        color: 'var(--text-primary)',
        ...style,
      }}
    >
      {/* Primary fresh message */}
      {primaryText.trim() && (
        <div style={{ marginBottom: hasQuotedTrail ? '12px' : '0' }}>
          {renderEmailBlocks(primaryText)}
        </div>
      )}

      {/* Quoted Trail (Gmail/Outlook style) */}
      {hasQuotedTrail && (
        <div style={{ marginTop: '8px' }}>
          {/* Trimmed content toggle button */}
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
                marginBottom: isQuoteExpanded ? '8px' : '0',
                transition: 'all 0.15s ease',
              }}
            >
              <MoreHorizontal size={13} />
              <span>{isQuoteExpanded ? 'Hide quoted text' : 'Show quoted text'}</span>
            </button>
          )}

          {/* Quoted email trail body */}
          {isQuoteExpanded && (
            <div
              style={{
                marginTop: '6px',
                paddingLeft: '12px',
                borderLeft: '3px solid var(--border-subtle, #cbd5e1)',
                color: 'var(--text-muted, #64748b)',
                fontSize: '13px',
                backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
                padding: '10px 14px',
                borderRadius: '0 6px 6px 0',
              }}
            >
              {quoteHeader && (
                <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary, #475569)' }}>
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

/**
 * Normalizes rich HTML and markdown emails with guaranteed zero URL corruption
 */
function normalizeEmailHtml(raw: string): string {
  let text = raw;

  // Stash map to protect URLs and domains from markdown syntax
  const stash: string[] = [];
  const stashUrl = (url: string) => {
    const idx = stash.length;
    stash.push(url);
    return `⟦TOKENURL${idx}⟧`;
  };

  // Clean Gmail / Outlook bracketed image URLs like: [https://lh7-rt.googleusercontent.com/...]
  text = text.replace(/\[\s*(https?:\/\/[^\s<>\"]+)\s*\]/gi, '$1');
  text = text.replace(/\[image:\s*(https?:\/\/[^\s<>\"]+)\s*\]/gi, '$1');

  if (text.includes('<')) {
    // Strip styles, scripts, head, and comments
    text = text
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

    // Headings: <h1> to <h6>
    text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n[H1:$1]\n');
    text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n[H2:$1]\n');
    text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n[H3:$1]\n');
    text = text.replace(/<h[4-6][^>]*>([\s\S]*?)<\/h[4-6]>/gi, '\n[H4:$1]\n');

    // Horizontal Rule: <hr>
    text = text.replace(/<hr\s*[\/]?>/gi, '\n[HR]\n');

    // Blockquotes: <blockquote>
    text = text.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '\n[QUOTE:$1]\n');

    // Code blocks: <pre><code>
    text = text.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n[CODEBLOCK:$1]\n');
    text = text.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n[CODEBLOCK:$1]\n');

    // Preserve inline images (e.g. signature logos): <img src="...">
    text = text.replace(/<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi, (_, src) => {
      return `\n[IMG:${stashUrl(src.trim())}]\n`;
    });

    // Preserve anchor links: <a href="http://...">Click here</a>
    text = text.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, content) => {
      const textContent = content.replace(/<[^>]*>/g, '').trim();
      const protectedHref = stashUrl(href.trim());
      return `[LINK:${textContent || href}|${protectedHref}]`;
    });

    // Outlook inline styled spans: font-weight: bold/700, font-style: italic, text-decoration: underline
    text = text.replace(/<span\s+[^>]*style=["'][^"']*font-weight:\s*(?:bold|[789]00)[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi, '[BOLD:$1]');
    text = text.replace(/<span\s+[^>]*style=["'][^"']*font-style:\s*italic[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi, '[ITALIC:$1]');
    text = text.replace(/<span\s+[^>]*style=["'][^"']*text-decoration:\s*underline[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi, '[UNDERLINE:$1]');
    text = text.replace(/<span\s+[^>]*style=["'][^"']*text-decoration:\s*line-through[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi, '[STRIKE:$1]');

    // Standard HTML formatting tags
    text = text.replace(/<(?:b|strong)[^>]*>([\s\S]*?)<\/(?:b|strong)>/gi, '[BOLD:$1]');
    text = text.replace(/<(?:i|em)[^>]*>([\s\S]*?)<\/(?:i|em)>/gi, '[ITALIC:$1]');
    text = text.replace(/<(?:u|ins)[^>]*>([\s\S]*?)<\/(?:u|ins)>/gi, '[UNDERLINE:$1]');
    text = text.replace(/<(?:del|s|strike)[^>]*>([\s\S]*?)<\/(?:del|s|strike)>/gi, '[STRIKE:$1]');
    text = text.replace(/<mark[^>]*>([\s\S]*?)<\/mark>/gi, '[MARK:$1]');
    text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '[CODE:$1]');

    // Lists
    text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n• $1');
    text = text.replace(/<\/ul>/gi, '\n');
    text = text.replace(/<\/ol>/gi, '\n');

    // Line breaks and containers
    text = text
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/tr>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'");
  }

  // Markdown code blocks: ```code```
  text = text.replace(/```(?:[a-z]*\n)?([\s\S]*?)```/g, '\n[CODEBLOCK:$1]\n');

  // Markdown headings: # Heading, ## Heading
  text = text.replace(/^#\s+(.+)$/gm, '[H1:$1]');
  text = text.replace(/^##\s+(.+)$/gm, '[H2:$1]');
  text = text.replace(/^###\s+(.+)$/gm, '[H3:$1]');

  // Markdown horizontal rules: --- or ***
  text = text.replace(/^(?:---|\*\*\*|___)\s*$/gm, '[HR]');

  // Stash Emails first
  text = text.replace(EMAIL_REGEX, (email) => {
    return stashUrl(email);
  });

  // Stash URLs & Domains (.com, .org, .in, etc.)
  text = text.replace(URL_OR_DOMAIN_REGEX, (matchedUrl) => {
    return stashUrl(matchedUrl);
  });

  // Markdown bold: **text** or *text* (Gmail style)
  text = text.replace(/\*\*([^*\n\r]+)\*\*/g, '[BOLD:$1]');
  text = text.replace(/\*([^*\n\r]+)\*/g, '[BOLD:$1]');

  // Markdown italics: _text_
  text = text.replace(/_([^_\n\r]+)_/g, '[ITALIC:$1]');

  // Markdown strikethrough: ~text~
  text = text.replace(/~([^~\n\r]+)~/g, '[STRIKE:$1]');

  // Markdown inline code: `text`
  text = text.replace(/`([^`\n\r]+)`/g, '[CODE:$1]');

  // Unstash all protected URLs safely!
  for (let i = 0; i < stash.length; i++) {
    text = text.replaceAll(`⟦TOKENURL${i}⟧`, stash[i]!);
  }

  return text.trim();
}

/**
 * Checks if a URL points to an image or image CDN
 */
function isImageUrl(url: string): boolean {
  if (!url) return false;
  const clean = url.trim().toLowerCase();
  return (
    /\.(gif|jpe?g|tiff?|png|webp|svg|bmp)(?:\?|$)/i.test(clean) ||
    clean.includes('googleusercontent.com') ||
    clean.includes('s3.amazonaws.com') ||
    clean.includes('/media/') ||
    clean.includes('/attachments/') ||
    clean.includes('/docsz/') ||
    clean.includes('/docs/')
  );
}

/**
 * Splits email body into primary fresh message and quoted reply trail
 */
function parseEmailQuotation(text: string) {
  const lines = text.split('\n');
  const primaryLines: string[] = [];
  const quotedLines: Array<{ level: number; text: string }> = [];
  let quoteHeader = '';
  let inQuote = false;

  const quoteHeaderPatterns = [
    /^on\s.+wrote:?$/i,
    /^-+\s*original message\s*-+$/i,
    /^-+\s*forwarded message\s*-+$/i,
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

/**
 * Renders blocks (Headings, Dividers, Code blocks, Lists, and Paragraphs)
 */
function renderEmailBlocks(text: string) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (!trimmed) {
      elements.push(<div key={i} style={{ height: '8px' }} />);
      continue;
    }

    if (trimmed === '[HR]') {
      elements.push(
        <hr
          key={i}
          style={{
            border: 'none',
            borderTop: '1px solid var(--border-subtle, #e2e8f0)',
            margin: '12px 0',
          }}
        />,
      );
      continue;
    }

    if (trimmed.startsWith('[H1:')) {
      const content = trimmed.slice(4, -1);
      elements.push(
        <h2 key={i} style={{ fontSize: '18px', fontWeight: 700, margin: '14px 0 6px', color: 'var(--text-primary)' }}>
          {renderRichText(content)}
        </h2>,
      );
      continue;
    }

    if (trimmed.startsWith('[H2:')) {
      const content = trimmed.slice(4, -1);
      elements.push(
        <h3 key={i} style={{ fontSize: '16px', fontWeight: 700, margin: '12px 0 4px', color: 'var(--text-primary)' }}>
          {renderRichText(content)}
        </h3>,
      );
      continue;
    }

    if (trimmed.startsWith('[H3:') || trimmed.startsWith('[H4:')) {
      const content = trimmed.slice(4, -1);
      elements.push(
        <h4 key={i} style={{ fontSize: '14px', fontWeight: 700, margin: '10px 0 4px', color: 'var(--text-primary)' }}>
          {renderRichText(content)}
        </h4>,
      );
      continue;
    }

    if (trimmed.startsWith('[CODEBLOCK:')) {
      const content = trimmed.slice(11, -1);
      elements.push(
        <pre
          key={i}
          style={{
            backgroundColor: 'var(--bg-surface-elevated, #0f172a)',
            color: '#f8fafc',
            padding: '12px 14px',
            borderRadius: '6px',
            fontSize: '12px',
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            overflowX: 'auto',
            margin: '8px 0',
            lineHeight: 1.5,
          }}
        >
          <code>{content}</code>
        </pre>,
      );
      continue;
    }

    if (trimmed.startsWith('[QUOTE:')) {
      const content = trimmed.slice(7, -1);
      elements.push(
        <blockquote
          key={i}
          style={{
            margin: '8px 0',
            padding: '6px 12px',
            borderLeft: '3px solid var(--primary, #2563eb)',
            backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
            borderRadius: '0 4px 4px 0',
            fontStyle: 'italic',
            color: 'var(--text-secondary, #475569)',
          }}
        >
          {renderRichText(content)}
        </blockquote>,
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
            gap: '8px',
            margin: '3px 0',
            paddingLeft: '6px',
          }}
        >
          <span style={{ color: 'var(--primary, #2563eb)', fontWeight: 700, lineHeight: 1.4 }}>•</span>
          <div style={{ flex: 1 }}>{renderRichText(itemText)}</div>
        </div>,
      );
      continue;
    }

    // Numbered list item: "1. ", "2) "
    const numberedMatch = trimmed.match(/^(\d+[\.\)])\s+(.*)$/);
    if (numberedMatch) {
      elements.push(
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            margin: '3px 0',
            paddingLeft: '6px',
          }}
        >
          <span style={{ fontWeight: 600, color: 'var(--text-muted)', minWidth: '18px' }}>
            {numberedMatch[1]}
          </span>
          <div style={{ flex: 1 }}>{renderRichText(numberedMatch[2]!)}</div>
        </div>,
      );
      continue;
    }

    // Regular line
    elements.push(
      <div key={i} style={{ minHeight: '20px' }}>
        {renderRichText(line)}
      </div>,
    );
  }

  return <div>{elements}</div>;
}

function renderQuotedLines(lines: Array<{ level: number; text: string }>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {lines.map((item, idx) => {
        if (!item.text.trim()) {
          return <div key={idx} style={{ height: '6px' }} />;
        }

        const isNested = item.level > 1;

        return (
          <div
            key={idx}
            style={{
              paddingLeft: isNested ? `${(item.level - 1) * 12}px` : '0px',
              borderLeft: isNested ? '2px solid var(--border-subtle, #cbd5e1)' : 'none',
              marginLeft: isNested ? '4px' : '0px',
              color: isNested ? 'var(--text-muted, #64748b)' : 'inherit',
            }}
          >
            {renderRichText(item.text)}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Safely renders rich text tokens recursively:
 * - [IMG:url] -> Compact inline signature logo (Outlook/Gmail)
 * - [LINK:Label|Url] -> Anchor tag with external link icon
 * - [BOLD:Text] -> Bold
 * - [ITALIC:Text] -> Italics
 * - [UNDERLINE:Text] -> Underline
 * - [STRIKE:Text] -> Strikethrough
 * - [MARK:Text] -> Highlight
 * - [CODE:Text] -> Inline code badge
 * - Domain URLs (abc.com, https://..., www....) -> Clickable links
 * - Emails (user@domain.com) -> Clickable mailto: links
 */
function renderRichText(text: string): React.ReactNode {
  const tokenRegex = new RegExp(
    `\\[IMG:([^\\]]+)\\]|\\[LINK:([^|]+)\\|([^\\]]+)\\]|\\[BOLD:([^\\]]+)\\]|\\[ITALIC:([^\\]]+)\\]|\\[UNDERLINE:([^\\]]+)\\]|\\[STRIKE:([^\\]]+)\\]|\\[MARK:([^\\]]+)\\]|\\[CODE:([^\\]]+)\\]|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})|(https?:\\/\\/[^\\s<>\"]+|(?:www\\.)?[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\\.(?:${DOMAIN_TLDS})(?::[0-9]{1,5})?(?:\\/[^\\s<>\"]*)?)|(mailto:[^\\s<>\"]+)|(tel:[^\\s<>\"]+)`,
    'gi',
  );

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = tokenRegex.exec(text)) !== null) {
    const matchIndex = match.index;

    if (matchIndex > lastIndex) {
      parts.push(text.substring(lastIndex, matchIndex));
    }

    const [
      fullMatch,
      imgUrl,
      linkLabel,
      linkUrl,
      boldText,
      italicText,
      underlineText,
      strikeText,
      markText,
      codeText,
      emailAddress,
      rawUrl,
      mailtoUrl,
      telUrl,
    ] = match;

    if (imgUrl) {
      // Natural signature / inline image rendering
      parts.push(
        <span key={matchIndex} style={{ display: 'inline-block', margin: '4px 0', verticalAlign: 'middle' }}>
          <img
            src={imgUrl}
            alt="Signature Logo"
            style={{
              maxWidth: '220px',
              maxHeight: '65px',
              objectFit: 'contain',
              display: 'block',
              borderRadius: '4px',
            }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </span>,
      );
    } else if (linkUrl) {
      const destination = linkUrl.startsWith('http://') || linkUrl.startsWith('https://')
        ? linkUrl
        : `https://${linkUrl}`;

      if (isImageUrl(linkUrl)) {
        parts.push(
          <div key={matchIndex} style={{ margin: '8px 0' }}>
            <img
              src={destination}
              alt="Inline Attachment"
              style={{
                maxWidth: '280px',
                maxHeight: '160px',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                objectFit: 'contain',
                display: 'block',
                backgroundColor: '#ffffff',
              }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <a
              href={destination}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '11px',
                color: 'var(--primary, #2563eb)',
                textDecoration: 'underline',
                marginTop: '4px',
              }}
            >
              <span>Open image</span>
              <ExternalLink size={10} />
            </a>
          </div>,
        );
      } else {
        parts.push(
          <a
            key={matchIndex}
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
            <span>{linkLabel || linkUrl}</span>
            <ExternalLink size={11} style={{ opacity: 0.8 }} />
          </a>,
        );
      }
    } else if (boldText) {
      parts.push(<strong key={matchIndex} style={{ fontWeight: 700 }}>{renderRichText(boldText)}</strong>);
    } else if (italicText) {
      parts.push(<em key={matchIndex} style={{ fontStyle: 'italic' }}>{renderRichText(italicText)}</em>);
    } else if (underlineText) {
      parts.push(<span key={matchIndex} style={{ textDecoration: 'underline' }}>{renderRichText(underlineText)}</span>);
    } else if (strikeText) {
      parts.push(<del key={matchIndex} style={{ textDecoration: 'line-through', opacity: 0.75 }}>{renderRichText(strikeText)}</del>);
    } else if (markText) {
      parts.push(
        <mark
          key={matchIndex}
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
    } else if (codeText) {
      parts.push(
        <code
          key={matchIndex}
          style={{
            backgroundColor: 'var(--bg-surface-elevated, #f1f5f9)',
            border: '1px solid var(--border-subtle, #e2e8f0)',
            padding: '2px 5px',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'monospace',
            color: 'var(--text-primary)',
          }}
        >
          {codeText}
        </code>,
      );
    } else if (emailAddress) {
      parts.push(
        <a
          key={matchIndex}
          href={`mailto:${emailAddress}`}
          style={{
            color: 'var(--primary, #2563eb)',
            textDecoration: 'underline',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
          }}
        >
          <Mail size={12} />
          <span>{emailAddress}</span>
        </a>,
      );
    } else if (mailtoUrl) {
      parts.push(
        <a
          key={matchIndex}
          href={mailtoUrl}
          style={{
            color: 'var(--primary, #2563eb)',
            textDecoration: 'underline',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
          }}
        >
          <Mail size={12} />
          <span>{mailtoUrl.replace('mailto:', '')}</span>
        </a>,
      );
    } else if (telUrl) {
      parts.push(
        <a
          key={matchIndex}
          href={telUrl}
          style={{
            color: 'var(--primary, #2563eb)',
            textDecoration: 'underline',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
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

      if (isImageUrl(rawUrl)) {
        parts.push(
          <div key={matchIndex} style={{ margin: '8px 0' }}>
            <img
              src={destination}
              alt="Inline Attachment"
              style={{
                maxWidth: '280px',
                maxHeight: '160px',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                objectFit: 'contain',
                display: 'block',
                backgroundColor: '#ffffff',
              }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <a
              href={destination}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '11px',
                color: 'var(--primary, #2563eb)',
                textDecoration: 'underline',
                marginTop: '4px',
              }}
            >
              <span>Open image</span>
              <ExternalLink size={10} />
            </a>
          </div>,
        );
      } else {
        parts.push(
          <a
            key={matchIndex}
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
    }

    lastIndex = matchIndex + fullMatch.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}
