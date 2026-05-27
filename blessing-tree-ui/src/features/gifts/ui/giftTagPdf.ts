import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import type { GiftTagTemplate } from '@/features/gifts/model/giftTagTemplateTypes';
import type { GiftLabelPayload, GiftLabelPrintItem, GiftLabelPrintJob } from '@/features/gifts/model/giftSearchTypes';

interface TagDesign {
  width: number;
  height: number;
  elements: TagElement[];
}

type TagElement = TagTextElement | TagImageElement | TagQrElement | TagRectElement;

interface TagElementBase {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

interface TagTextElement extends TagElementBase {
  type: 'text';
  text: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fill?: string;
  align?: 'left' | 'center' | 'right';
}

interface TagImageElement extends TagElementBase {
  type: 'image';
  src: string;
}

interface TagQrElement extends TagElementBase {
  type: 'qr';
}

interface TagRectElement extends TagElementBase {
  type: 'rect';
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

const pageWidth = 8.5;
const pageHeight = 11;
const pageMargin = 0.25;

export async function exportGiftTagPrintJobPdf(job: GiftLabelPrintJob, template: GiftTagTemplate): Promise<void> {
  const design = extractDesign(template);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter' });
  const imageCache = new Map<string, string>();
  const labels = expandPrintItems(job.items);
  const columns = Math.max(Math.floor((pageWidth - pageMargin * 2) / design.width), 1);
  const rows = Math.max(Math.floor((pageHeight - pageMargin * 2) / design.height), 1);
  const tagsPerPage = columns * rows;
  const gapX = columns > 1 ? (pageWidth - pageMargin * 2 - columns * design.width) / (columns - 1) : 0;
  const gapY = rows > 1 ? (pageHeight - pageMargin * 2 - rows * design.height) / (rows - 1) : 0;

  for (let index = 0; index < labels.length; index += 1) {
    if (index > 0 && index % tagsPerPage === 0) {
      pdf.addPage();
    }
    const pageIndex = index % tagsPerPage;
    const column = pageIndex % columns;
    const row = Math.floor(pageIndex / columns);
    const originX = pageMargin + column * (design.width + gapX);
    const originY = pageMargin + row * (design.height + gapY);
    await renderTag(pdf, design, labels[index], originX, originY, template.includeCutLinesDefault, imageCache);
  }

  pdf.save(`gift-tags-${job.id}.pdf`);
}

function expandPrintItems(items: GiftLabelPrintItem[]): GiftLabelPrintItem[] {
  return items.flatMap((item) => Array.from({ length: Math.max(item.copies || 1, 1) }, () => item));
}

async function renderTag(
  pdf: jsPDF,
  design: TagDesign,
  item: GiftLabelPrintItem,
  originX: number,
  originY: number,
  includeCutLines: boolean,
  imageCache: Map<string, string>
) {
  pdf.setFillColor('#fffdf9');
  pdf.rect(originX, originY, design.width, design.height, 'F');
  if (includeCutLines) {
    pdf.setDrawColor('#d4af37');
    pdf.setLineWidth(0.01);
    pdf.setLineDashPattern([0.08, 0.05], 0);
    pdf.rect(originX, originY, design.width, design.height, 'S');
    pdf.setLineDashPattern([], 0);
  }

  for (const element of design.elements) {
    if (element.type === 'text') {
      renderText(pdf, element, item.label, originX, originY);
    } else if (element.type === 'rect') {
      renderRect(pdf, element, originX, originY);
    } else if (element.type === 'image') {
      const dataUrl = await imageToDataUrl(element.src, imageCache);
      pdf.addImage(dataUrl, imageFormat(dataUrl), originX + element.x, originY + element.y, element.width, element.height);
    } else if (element.type === 'qr') {
      const qrDataUrl = await QRCode.toDataURL(absoluteUrl(item.label.scan_path), { margin: 1, width: 512 });
      pdf.addImage(qrDataUrl, 'PNG', originX + element.x, originY + element.y, element.width, element.height);
    }
  }
}

function renderText(pdf: jsPDF, element: TagTextElement, label: GiftLabelPayload, originX: number, originY: number) {
  const text = mergeText(element.text, label);
  if (!text.trim()) return;
  pdf.setTextColor(element.fill ?? '#2d1544');
  pdf.setFont(element.fontFamily ?? 'helvetica', element.fontWeight === 'bold' ? 'bold' : 'normal');
  pdf.setFontSize(element.fontSize ?? 10);
  const lines = pdf.splitTextToSize(text, element.width);
  pdf.text(lines, originX + element.x, originY + element.y + (element.fontSize ?? 10) / 72, {
    maxWidth: element.width,
    align: element.align ?? 'left',
    angle: element.rotation ?? 0,
  });
}

function renderRect(pdf: jsPDF, element: TagRectElement, originX: number, originY: number) {
  if (element.fill) {
    pdf.setFillColor(element.fill);
  }
  if (element.stroke) {
    pdf.setDrawColor(element.stroke);
  }
  pdf.setLineWidth((element.strokeWidth ?? 1) / 72);
  pdf.rect(originX + element.x, originY + element.y, element.width, element.height, element.fill && element.stroke ? 'FD' : element.fill ? 'F' : 'S');
}

function mergeText(text: string, label: GiftLabelPayload): string {
  return text
    .replaceAll('{{recipient_display_name}}', label.recipient.display_label ?? '')
    .replaceAll('{{family_or_group_name}}', label.recipient.group_label ?? '')
    .replaceAll('{{age_display}}', formatAge(label.recipient.age, label.recipient.age_unit))
    .replaceAll('{{gender}}', formatGender(label.recipient.gender))
    .replaceAll('{{campaign_name}}', label.campaign.name)
    .replaceAll('{{campaign_purpose}}', label.theme?.purpose ?? label.campaign.name)
    .replaceAll('{{gift_tag_message}}', '')
    .replaceAll('{{gift_description}}', label.gift.description ?? '');
}

function extractDesign(template: GiftTagTemplate): TagDesign {
  const design = template.layoutJson.design as Partial<TagDesign> | undefined;
  return {
    width: Number(design?.width ?? template.tagWidthIn),
    height: Number(design?.height ?? template.tagHeightIn),
    elements: Array.isArray(design?.elements) ? design.elements.filter(isTagElement) : [],
  };
}

function isTagElement(value: unknown): value is TagElement {
  if (!value || typeof value !== 'object') return false;
  const element = value as Partial<TagElement>;
  return typeof element.id === 'string' && ['text', 'image', 'qr', 'rect'].includes(String(element.type));
}

async function imageToDataUrl(src: string, cache: Map<string, string>): Promise<string> {
  if (cache.has(src)) return cache.get(src) as string;
  if (src.startsWith('data:')) {
    cache.set(src, src);
    return src;
  }
  const response = await fetch(src);
  const blob = await response.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  cache.set(src, dataUrl);
  return dataUrl;
}

function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${window.location.origin}${path}`;
}

function imageFormat(dataUrl: string): 'PNG' | 'JPEG' {
  return dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg') ? 'JPEG' : 'PNG';
}

function formatAge(age: number | null | undefined, ageUnit: string | null | undefined): string {
  if (age === null || age === undefined) return '';
  return `${age} ${ageUnit === 'MONTHS' ? 'mo' : 'yr'}`;
}

function formatGender(gender: string | null | undefined): string {
  if (!gender) return '';
  if (gender === 'F') return 'Female';
  if (gender === 'M') return 'Male';
  return gender
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
