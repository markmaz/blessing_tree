import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import Konva from 'konva';
import QRCode from 'qrcode';
import { Image as KonvaImage, Layer, Rect, Stage, Text, Transformer } from 'react-konva';
import { Link, useParams } from 'react-router-dom';
import { buildCampaignGiftsReportsPath } from '@/app/routes';
import { getGiftTagTemplate, updateGiftTagTemplate } from '@/features/gifts/api/giftTagTemplateApi';
import type { GiftTagTemplate } from '@/features/gifts/model/giftTagTemplateTypes';
import '@/features/gifts/ui/giftTagBuilder.css';

type TagElement = TagTextElement | TagImageElement | TagQrElement | TagRectElement;

interface TagElementBase {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  locked?: boolean;
}

interface TagTextElement extends TagElementBase {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight?: string;
  fontStyle?: string;
  fill: string;
  align?: 'left' | 'center' | 'right';
}

interface TagImageElement extends TagElementBase {
  type: 'image';
  src: string;
  altText?: string;
}

interface TagQrElement extends TagElementBase {
  type: 'qr';
  required?: boolean;
}

interface TagRectElement extends TagElementBase {
  type: 'rect';
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
}

interface TagDesign {
  editor: 'konva';
  version: 1;
  unit: 'in';
  width: number;
  height: number;
  elements: TagElement[];
}

const pixelsPerInch = 240;
const tagSizes = {
  large: { width: 3, height: 2, label: '3 x 2' },
  compact: { width: 2, height: 2, label: '2 x 2' },
} as const;
const mergeFields = [
  '{{recipient_display_name}}',
  '{{family_or_group_name}}',
  '{{age_display}}',
  '{{gender}}',
  '{{campaign_name}}',
  '{{campaign_purpose}}',
  '{{gift_tag_message}}',
  '{{gift_description}}',
];

export function GiftTagBuilderPage() {
  const { campaignId = '' } = useParams();
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const nodeRefs = useRef<Record<string, Konva.Node | null>>({});
  const [template, setTemplate] = useState<GiftTagTemplate | null>(null);
  const [elements, setElements] = useState<TagElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [loadedImages, setLoadedImages] = useState<Record<string, HTMLImageElement>>({});
  const [qrImage, setQrImage] = useState<HTMLImageElement | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedElement = useMemo(
    () => elements.find((element) => element.id === selectedElementId) ?? null,
    [elements, selectedElementId]
  );
  const tagWidth = template?.tagWidthIn ?? 3;
  const tagHeight = template?.tagHeightIn ?? 2;
  const selectedText = selectedElement?.type === 'text' ? selectedElement : null;
  const selectedElementMinimumSize = selectedElement ? getMinimumElementSize(selectedElement, tagWidth, tagHeight) : 0.08;
  const stageWidth = tagWidth * pixelsPerInch;
  const stageHeight = tagHeight * pixelsPerInch;

  useEffect(() => {
    let isActive = true;
    async function load() {
      try {
        const response = await getGiftTagTemplate(campaignId);
        if (!isActive) return;
        setTemplate(response);
        setElements(elementsFromLayout(response.layoutJson));
      } catch (loadError) {
        if (isActive) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load gift tag builder.');
        }
      }
    }
    void load();
    return () => {
      isActive = false;
    };
  }, [campaignId]);

  useEffect(() => {
    void QRCode.toDataURL('/public/gifts/scan/SAMPLE', { margin: 1, width: 360 }).then((src) => {
      const image = new window.Image();
      image.onload = () => setQrImage(image);
      image.src = src;
    });
  }, []);

  useEffect(() => {
    elements
      .filter((element): element is TagImageElement => element.type === 'image')
      .forEach((element) => {
        if (loadedImages[element.id]) return;
        const image = new window.Image();
        if (!element.src.startsWith('data:')) {
          image.crossOrigin = 'anonymous';
        }
        image.onload = () => setLoadedImages((current) => ({ ...current, [element.id]: image }));
        image.src = element.src;
      });
  }, [elements, loadedImages]);

  useEffect(() => {
    const selectedNode = selectedElementId ? nodeRefs.current[selectedElementId] : null;
    if (selectedNode && transformerRef.current) {
      transformerRef.current.nodes([selectedNode]);
      transformerRef.current.getLayer()?.batchDraw();
      return;
    }
    transformerRef.current?.nodes([]);
    transformerRef.current?.getLayer()?.batchDraw();
  }, [selectedElementId, elements]);

  async function handleSave() {
    if (!template) return;
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await updateGiftTagTemplate(campaignId, {
        name: template.name,
        tagWidthIn: tagWidth,
        tagHeightIn: tagHeight,
        orientation: tagWidth >= tagHeight ? 'LANDSCAPE' : 'PORTRAIT',
        giftTagMessage: template.giftTagMessage,
        includeCutLinesDefault: template.includeCutLinesDefault,
        layoutJson: createLayout(tagWidth, tagHeight, elements),
      });
      setTemplate(saved);
      setElements(elementsFromLayout(saved.layoutJson));
      setMessage('Gift tag template saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save gift tag template.');
    } finally {
      setIsSaving(false);
    }
  }

  function updateTemplate(patch: Partial<GiftTagTemplate>) {
    setTemplate((current) => (current ? { ...current, ...patch } : current));
  }

  function updateElement(elementId: string, patch: Partial<TagElement>) {
    setElements((current) =>
      current.map((element) => (element.id === elementId ? ({ ...element, ...patch } as TagElement) : element))
    );
  }

  function updateSelectedElement(patch: Partial<TagElement>) {
    if (!selectedElement) return;
    updateElement(selectedElement.id, patch);
  }

  function addText(text = 'New text') {
    const element: TagTextElement = {
      id: crypto.randomUUID(),
      type: 'text',
      text,
      x: 0.24,
      y: 0.24,
      width: 1.4,
      height: 0.25,
      fontSize: 12,
      fontFamily: 'Arial',
      fill: '#2d1544',
    };
    setElements((current) => [...current, element]);
    setSelectedElementId(element.id);
  }

  function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      const element: TagImageElement = {
        id: crypto.randomUUID(),
        type: 'image',
        src: reader.result,
        x: 0.24,
        y: 0.24,
        width: 0.65,
        height: 0.65,
        altText: file.name,
      };
      setElements((current) => [...current, element]);
      setSelectedElementId(element.id);
    };
    reader.readAsDataURL(file);
  }

  function deleteSelected() {
    if (!selectedElement || selectedElement.type === 'qr') return;
    setElements((current) => current.filter((element) => element.id !== selectedElement.id));
    setSelectedElementId(null);
  }

  function handleSizeChange(size: '3x2' | '2x2') {
    if (!template) return;
    const [width, height] = size === '3x2' ? [tagSizes.large.width, tagSizes.large.height] : [tagSizes.compact.width, tagSizes.compact.height];
    updateTemplate({ tagWidthIn: width, tagHeightIn: height, orientation: width >= height ? 'LANDSCAPE' : 'PORTRAIT' });
    setElements(defaultElements(width, height));
    setSelectedElementId(null);
  }

  function handleResetTemplate() {
    if (!template) return;
    const confirmed = window.confirm('Reset this tag to the default layout? Unsaved changes will be replaced.');
    if (!confirmed) return;
    setElements(defaultElements(tagWidth, tagHeight));
    setSelectedElementId(null);
    setMessage('Template reset to the default layout. Save to keep this change.');
    setError(null);
  }

  if (!template && !error) {
    return <p className="text-muted">Loading gift tag builder...</p>;
  }

  return (
    <section className="gift-tag-builder">
      <div className="gift-tag-builder__actions">
        <Link to={buildCampaignGiftsReportsPath(campaignId)} className="btn btn-outline-secondary btn-sm">
          <i className="bi bi-arrow-left-circle me-2" aria-hidden="true" />
          Back to Gift Status
        </Link>
        <button type="button" className="btn btn-secondary btn-sm" disabled={isSaving || !template} onClick={() => void handleSave()}>
          <i className="bi bi-floppy me-2" aria-hidden="true" />
          {isSaving ? 'Saving...' : 'Save Template'}
        </button>
      </div>

      <div className="campaign-studio-page__header">
        <div>
          <div className="campaign-chip-row mb-3">
            <span className="campaign-chip campaign-chip-muted">Gifts</span>
            <span className="campaign-chip campaign-chip-muted">Gift Tag Builder</span>
          </div>
          <h1 className="h3 mb-1">Gift Tag Builder</h1>
          <p className="text-muted mb-0">
            Design the campaign tag used when staff print labels for gifts. The QR code is required.
          </p>
        </div>
      </div>

      {error ? <div className="alert alert-danger" role="alert">{error}</div> : null}
      {message ? <div className="alert alert-success" role="status">{message}</div> : null}

      {template ? (
        <div className="gift-tag-builder__shell">
          <aside className="gift-tag-builder__panel">
            <section className="gift-tag-builder__section">
              <h2>Template</h2>
              <label className="form-label">
                Name
                <input className="form-control" value={template.name} onChange={(event) => updateTemplate({ name: event.target.value })} />
              </label>
              <div className="gift-tag-builder__size-grid">
                <button
                  type="button"
                  className={`btn btn-sm ${tagWidth === 3 && tagHeight === 2 ? 'btn-secondary' : 'btn-outline-secondary'}`}
                  onClick={() => handleSizeChange('3x2')}
                >
                  {tagSizes.large.label}
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${tagWidth === 2 && tagHeight === 2 ? 'btn-secondary' : 'btn-outline-secondary'}`}
                  onClick={() => handleSizeChange('2x2')}
                >
                  {tagSizes.compact.label}
                </button>
              </div>
              <label className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={template.includeCutLinesDefault}
                  onChange={(event) => updateTemplate({ includeCutLinesDefault: event.target.checked })}
                />
                <span className="form-check-label">Show cut lines by default</span>
              </label>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleResetTemplate}>
                <i className="bi bi-arrow-counterclockwise me-1" aria-hidden="true" />
                Reset Layout
              </button>
            </section>

            <section className="gift-tag-builder__section">
              <h2>Merge Fields</h2>
              <div className="gift-tag-builder__merge-fields">
                {mergeFields.map((field) => (
                  <button key={field} type="button" className="btn btn-outline-secondary btn-sm" onClick={() => addText(field)}>
                    {field.replace(/[{}]/g, '')}
                  </button>
                ))}
              </div>
            </section>

            {selectedText ? (
              <section className="gift-tag-builder__section">
                <h2>Selected Text</h2>
                <label className="form-label">
                  Text
                  <textarea className="form-control" rows={3} value={selectedText.text} onChange={(event) => updateElement(selectedText.id, { text: event.target.value })} />
                </label>
                <label className="form-label">
                  Font Size
                  <input
                    className="form-control"
                    type="number"
                    min={5}
                    max={36}
                    value={selectedText.fontSize}
                    onChange={(event) => updateElement(selectedText.id, { fontSize: Number(event.target.value) || 10 })}
                  />
                </label>
                <input
                  aria-label="Text color"
                  type="color"
                  className="form-control form-control-color"
                  value={selectedText.fill}
                  onChange={(event) => updateElement(selectedText.id, { fill: event.target.value })}
                />
              </section>
            ) : null}

            {selectedElement ? (
              <section className="gift-tag-builder__section">
                <h2>Selected Object</h2>
                <div className="gift-tag-builder__number-grid">
                  <NumberField label="X" value={selectedElement.x} min={0} max={tagWidth} onChange={(value) => updateSelectedElement({ x: value })} />
                  <NumberField label="Y" value={selectedElement.y} min={0} max={tagHeight} onChange={(value) => updateSelectedElement({ y: value })} />
                  <NumberField
                    label="W"
                    value={selectedElement.width}
                    min={selectedElementMinimumSize}
                    max={tagWidth}
                    onChange={(value) => updateSelectedElement({ width: value })}
                  />
                  <NumberField
                    label="H"
                    value={selectedElement.height}
                    min={selectedElementMinimumSize}
                    max={tagHeight}
                    onChange={(value) => updateSelectedElement({ height: value })}
                  />
                  <NumberField label="Rot" value={selectedElement.rotation ?? 0} min={-180} max={180} step={1} onChange={(value) => updateSelectedElement({ rotation: value })} />
                </div>
                {selectedElement.type === 'qr' ? (
                  <div className="gift-tag-builder__locked-note">
                    <i className="bi bi-qr-code" aria-hidden="true" />
                    <span>Required QR</span>
                  </div>
                ) : null}
              </section>
            ) : null}
          </aside>

          <div className="gift-tag-builder__workspace">
            <div className="gift-tag-builder__toolbar">
              <div className="gift-tag-builder__tool-group">
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => addText()}>
                  <i className="bi bi-type me-1" aria-hidden="true" />
                  Text
                </button>
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => imageInputRef.current?.click()}>
                  <i className="bi bi-image me-1" aria-hidden="true" />
                  Image
                </button>
                <input ref={imageInputRef} type="file" accept="image/*" className="d-none" onChange={handleImageUpload} />
                <button type="button" className="btn btn-outline-danger btn-sm" disabled={!selectedElement || selectedElement.type === 'qr'} onClick={deleteSelected}>
                  <i className="bi bi-trash me-1" aria-hidden="true" />
                  Delete
                </button>
              </div>
              <span className="text-muted small">{tagWidth} in x {tagHeight} in</span>
            </div>
            <div className="gift-tag-builder__stage-wrap">
              <Stage
                ref={stageRef}
                width={stageWidth}
                height={stageHeight}
                onMouseDown={(event) => {
                  if (event.target === event.target.getStage()) setSelectedElementId(null);
                }}
              >
                <Layer>
                  <Rect x={0} y={0} width={stageWidth} height={stageHeight} fill="#fffdf9" listening={false} />
                  {template.includeCutLinesDefault ? (
                    <Rect x={6} y={6} width={stageWidth - 12} height={stageHeight - 12} stroke="#d4af37" strokeWidth={2} dash={[8, 6]} listening={false} />
                  ) : null}
                  {elements.map((element) => (
                    <TagElementNode
                      key={element.id}
                      element={element}
                      qrImage={qrImage}
                      image={element.type === 'image' ? loadedImages[element.id] : undefined}
                      onSelect={() => setSelectedElementId(element.id)}
                      onChange={(patch) => updateElement(element.id, patch)}
                      setNode={(node) => {
                        nodeRefs.current[element.id] = node;
                      }}
                    />
                  ))}
                  <Transformer
                    ref={transformerRef}
                    rotateEnabled
                    enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right']}
                    boundBoxFunc={(oldBox, newBox) => {
                      const minimumSize = selectedElement ? getMinimumElementSize(selectedElement, tagWidth, tagHeight) * pixelsPerInch : 20;
                      return newBox.width < minimumSize || newBox.height < minimumSize ? oldBox : newBox;
                    }}
                  />
                </Layer>
              </Stage>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 0.05,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="form-label">
      {label}
      <input
        className="form-control form-control-sm"
        type="number"
        min={min}
        max={max}
        step={step}
        value={roundForInput(value)}
        onChange={(event) => {
          const nextValue = Number(event.target.value);
          if (Number.isNaN(nextValue)) return;
          onChange(clamp(nextValue, min, max));
        }}
      />
    </label>
  );
}

function TagElementNode({
  element,
  qrImage,
  image,
  onSelect,
  onChange,
  setNode,
}: {
  element: TagElement;
  qrImage: HTMLImageElement | null;
  image?: HTMLImageElement;
  onSelect: () => void;
  onChange: (patch: Partial<TagElement>) => void;
  setNode: (node: Konva.Node | null) => void;
}) {
  const common = {
    x: element.x * pixelsPerInch,
    y: element.y * pixelsPerInch,
    width: element.width * pixelsPerInch,
    height: element.height * pixelsPerInch,
    rotation: element.rotation ?? 0,
    draggable: !element.locked,
    onClick: onSelect,
    onTap: onSelect,
    onDragEnd: (event: Konva.KonvaEventObject<Event>) => onChange({ x: event.target.x() / pixelsPerInch, y: event.target.y() / pixelsPerInch }),
    onTransformEnd: (event: Konva.KonvaEventObject<Event>) => {
      const node = event.target;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);
      onChange({
        x: node.x() / pixelsPerInch,
        y: node.y() / pixelsPerInch,
        width: Math.max(0.08, element.width * scaleX),
        height: Math.max(0.08, element.height * scaleY),
        rotation: node.rotation(),
      });
    },
  };
  if (element.type === 'text') {
    return (
      <Text
        ref={setNode}
        {...common}
        text={sampleText(element.text)}
        fontSize={element.fontSize * 2.4}
        fontFamily={element.fontFamily}
        fontStyle={[element.fontStyle, element.fontWeight].filter(Boolean).join(' ')}
        fill={element.fill}
        align={element.align}
      />
    );
  }
  if (element.type === 'image') {
    return <KonvaImage ref={setNode} {...common} image={image} />;
  }
  if (element.type === 'qr') {
    return qrImage ? <KonvaImage ref={setNode} {...common} image={qrImage} /> : <Rect ref={setNode} {...common} stroke="#2d1544" strokeWidth={2} />;
  }
  return <Rect ref={setNode} {...common} fill={element.fill} stroke={element.stroke} strokeWidth={element.strokeWidth} cornerRadius={element.cornerRadius} />;
}

function getMinimumElementSize(element: TagElement, tagWidth: number, tagHeight: number): number {
  if (element.type === 'qr') {
    return tagWidth === 2 && tagHeight === 2 ? 0.75 : 0.9;
  }
  return 0.08;
}

function roundForInput(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function elementsFromLayout(layout: Record<string, unknown>): TagElement[] {
  const design = layout.design;
  if (!design || typeof design !== 'object' || !Array.isArray((design as Partial<TagDesign>).elements)) {
    return defaultElements(3, 2);
  }
  return (design as Partial<TagDesign>).elements?.filter(isTagElement) ?? defaultElements(3, 2);
}

function createLayout(width: number, height: number, elements: TagElement[]): Record<string, unknown> {
  return {
    editor: 'konva',
    design: {
      editor: 'konva',
      version: 1,
      unit: 'in',
      width,
      height,
      elements,
    },
  };
}

function defaultElements(width: number, height: number): TagElement[] {
  return [
    { id: 'logo', type: 'image', src: '/blessing-tree-logo.png', x: 0.12, y: 0.12, width: 0.46, height: 0.46, altText: 'Blessing Tree logo' },
    { id: 'recipient-name', type: 'text', text: '{{recipient_display_name}}', x: 0.66, y: 0.16, width: Math.max(1, width - 1.72), height: 0.28, fontSize: 16, fontFamily: 'Arial', fontWeight: 'bold', fill: '#2d1544' },
    { id: 'family-group', type: 'text', text: '{{family_or_group_name}}', x: 0.12, y: 0.72, width: Math.max(1, width - 1.22), height: 0.24, fontSize: 10, fontFamily: 'Arial', fill: '#34271e' },
    { id: 'age-gender', type: 'text', text: '{{age_display}} {{gender}}', x: 0.12, y: 1.02, width: Math.max(1, width - 1.22), height: 0.22, fontSize: 10, fontFamily: 'Arial', fill: '#6f5c45' },
    { id: 'campaign-purpose', type: 'text', text: '{{campaign_purpose}}', x: 0.12, y: Math.max(1.16, height - 0.52), width: Math.max(1, width - 1.42), height: 0.22, fontSize: 8, fontFamily: 'Arial', fill: '#6f5c45' },
    { id: 'qr', type: 'qr', x: Math.max(0.86, width - 0.98), y: Math.max(0.74, height - 1.22), width: width === 2 ? 0.75 : 0.9, height: width === 2 ? 0.75 : 0.9, required: true },
  ];
}

function isTagElement(value: unknown): value is TagElement {
  if (!value || typeof value !== 'object') return false;
  const element = value as Partial<TagElement>;
  return typeof element.id === 'string' && ['text', 'image', 'qr', 'rect'].includes(String(element.type));
}

function sampleText(text: string): string {
  return text
    .replaceAll('{{recipient_display_name}}', 'Ava')
    .replaceAll('{{family_or_group_name}}', 'Martinez Family')
    .replaceAll('{{age_display}}', '8')
    .replaceAll('{{gender}}', 'Girl')
    .replaceAll('{{campaign_name}}', 'Christmas Giving')
    .replaceAll('{{campaign_purpose}}', 'Blessing Tree')
    .replaceAll('{{gift_tag_message}}', '')
    .replaceAll('{{gift_description}}', '');
}
