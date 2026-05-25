import { QRCodeSVG } from 'qrcode.react';
import type { CSSProperties } from 'react';
import type { GiftLabelPrintItem } from '@/features/gifts/model/giftSearchTypes';

interface GiftTagPreviewProps {
  item: GiftLabelPrintItem;
}

export function GiftTagPreview({ item }: GiftTagPreviewProps) {
  const label = item.label;
  const theme = label.theme ?? {
    purpose: label.campaign.name,
    icon: 'bi-gift-fill',
    accent: '#5d3581',
  };
  const recipientDetails = [formatAge(label.recipient.age, label.recipient.age_unit), formatGender(label.recipient.gender)]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="gift-tag-preview">
      <div className="gift-tag-preview__topline">
        <span className="gift-tag-preview__campaign">{label.campaign.name} {label.campaign.year}</span>
        <span className="gift-tag-preview__theme" style={{ '--gift-tag-accent': theme.accent } as CSSProperties}>
          <i className={`bi ${theme.icon}`} aria-hidden="true" />
        </span>
      </div>
      <div className="gift-tag-preview__body">
        <div className="gift-tag-preview__recipient">
          <span className="gift-tag-preview__label">For</span>
          <strong>{label.recipient.display_label ?? 'Recipient'}</strong>
          <span>{label.recipient.group_label ?? theme.purpose ?? 'Blessing Tree'}</span>
          {recipientDetails ? <span>{recipientDetails}</span> : null}
        </div>
        <QRCodeSVG value={absoluteScanUrl(label.scan_path)} size={86} includeMargin />
      </div>
      <a
        className="gift-tag-preview__scan-link"
        href={absoluteScanUrl(label.scan_path)}
        target="_blank"
        rel="noreferrer"
      >
        <i className="bi bi-phone" aria-hidden="true" />
        Open Mobile Scan
      </a>
    </div>
  );
}

function absoluteScanUrl(scanPath: string): string {
  if (typeof window === 'undefined') {
    return scanPath;
  }
  return `${window.location.origin}${scanPath}`;
}

function formatAge(age: number | null | undefined, ageUnit: string | null | undefined): string | null {
  if (age === null || age === undefined) {
    return null;
  }
  const unit = ageUnit === 'MONTHS' ? 'mo' : 'yr';
  return `${age} ${unit}`;
}

function formatGender(gender: string | null | undefined): string | null {
  if (!gender) {
    return null;
  }
  if (gender === 'F') return 'Female';
  if (gender === 'M') return 'Male';
  return gender
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
