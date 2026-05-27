import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import Konva from 'konva';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { Image as KonvaImage, Layer, Rect, Stage, Text, Transformer } from 'react-konva';
import { Link, useParams } from 'react-router-dom';
import {
  buildCampaignStudioPath,
  buildPublicCampaignSponsorPath,
} from '@/app/routes';
import {
  createCampaignFlyer,
  deleteCampaignFlyer,
  listCampaignFlyers,
  updateCampaignFlyer,
} from '@/features/campaigns/api/campaignFlyerApi';
import { getCampaign } from '@/features/campaigns/api/campaignApi';
import { CampaignStudioDrawer } from '@/features/campaigns/ui/CampaignStudioDrawer';
import type { CampaignFlyer, CampaignFlyerInput } from '@/features/campaigns/model/campaignFlyerTypes';
import type { Campaign } from '@/features/campaigns/model/campaignTypes';
import '@/features/campaigns/ui/publicSponsors.css';

interface FlyerDraft extends CampaignFlyerInput {
  sourceFlyerId: string | null;
}
type FlyerElement = FlyerTextElement | FlyerImageElement | FlyerRectElement;

interface FlyerElementBase {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  locked?: boolean;
}

interface FlyerTextElement extends FlyerElementBase {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fontStyle?: string;
  fontWeight?: string;
  fill: string;
  align?: 'left' | 'center' | 'right';
  lineHeight?: number;
}

interface FlyerImageElement extends FlyerElementBase {
  type: 'image';
  src: string;
  altText?: string;
}

interface FlyerRectElement extends FlyerElementBase {
  type: 'rect';
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
}

interface KonvaFlyerDesign {
  editor: 'konva';
  version: 1;
  width: number;
  height: number;
  elements: FlyerElement[];
}

const letterWidth = 816;
const letterHeight = 1056;
const editorBaseScale = 0.72;
const backgroundColor = '#fffdf9';

export function CampaignSponsorFlyerPage() {
  const { campaignId = '' } = useParams();
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const nodeRefs = useRef<Record<string, Konva.Node | null>>({});
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const draftRef = useRef<FlyerDraft>(createBlankFlyerDraft());
  const elementsRef = useRef<FlyerElement[]>([]);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [flyers, setFlyers] = useState<CampaignFlyer[]>([]);
  const [selectedFlyerId, setSelectedFlyerId] = useState<string | null>(null);
  const [draft, setDraft] = useState<FlyerDraft>(() => createBlankFlyerDraft());
  const [elements, setElements] = useState<FlyerElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [loadedImages, setLoadedImages] = useState<Record<string, HTMLImageElement>>({});
  const [zoom, setZoom] = useState(100);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedElement = useMemo(
    () => elements.find((element) => element.id === selectedElementId) ?? null,
    [elements, selectedElementId]
  );

  const publicUrl = useMemo(() => {
    if (!campaign?.publicSponsorSlug) {
      return null;
    }
    return `${window.location.origin}${buildPublicCampaignSponsorPath(campaign.publicSponsorSlug)}`;
  }, [campaign]);

  const qrUrl = draft.qrTargetType === 'PUBLIC_SPONSOR_SIGNUP'
    ? publicUrl
    : draft.qrTargetType === 'CUSTOM_URL'
      ? draft.qrCustomUrl
      : null;

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    elementsRef.current = elements;
    draftRef.current = {
      ...draftRef.current,
      layoutJson: createKonvaLayout(elements),
    };
  }, [elements]);

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

  useEffect(() => {
    const imageElements = elements.filter((element): element is FlyerImageElement => element.type === 'image');
    imageElements.forEach((element) => {
      if (loadedImages[element.id]) {
        return;
      }
      const image = new window.Image();
      if (!element.src.startsWith('data:')) {
        image.crossOrigin = 'anonymous';
      }
      image.onload = () => setLoadedImages((current) => ({ ...current, [element.id]: image }));
      image.src = element.src;
    });
  }, [elements, loadedImages]);

  useEffect(() => {
    let isActive = true;
    async function load() {
      try {
        const [campaignResponse, flyerResponse] = await Promise.all([
          getCampaign(campaignId),
          listCampaignFlyers(campaignId),
        ]);
        if (!isActive) {
          return;
        }
        setCampaign(campaignResponse);
        setFlyers(flyerResponse);
        const firstFlyer = flyerResponse[0] ?? null;
        const nextDraft = firstFlyer ? draftFromFlyer(firstFlyer) : createBlankFlyerDraft(campaignResponse);
        setSelectedFlyerId(firstFlyer?.id ?? null);
        setDraft(nextDraft);
        draftRef.current = nextDraft;
        setElements(await elementsFromDraft(nextDraft, campaignResponse, resolveDraftQrUrl(nextDraft, campaignResponse)));
      } catch (loadError) {
        if (isActive) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load flyer builder.');
        }
      }
    }
    void load();
    return () => {
      isActive = false;
    };
  }, [campaignId]);

  async function reloadFlyers(nextSelectedId?: string | null) {
    const response = await listCampaignFlyers(campaignId);
    setFlyers(response);
    const nextSelected = response.find((flyer) => flyer.id === nextSelectedId) ?? response[0] ?? null;
    const nextDraft = nextSelected ? draftFromFlyer(nextSelected) : createBlankFlyerDraft(campaign ?? undefined);
    setSelectedFlyerId(nextSelected?.id ?? null);
    setDraft(nextDraft);
    draftRef.current = nextDraft;
    setSelectedElementId(null);
    if (campaign) {
      setElements(await elementsFromDraft(nextDraft, campaign, resolveDraftQrUrl(nextDraft, campaign)));
    }
  }

  async function openNewFlyer() {
    const nextDraft = createUniqueFlyerDraft(campaign ?? undefined, flyers);
    setSelectedFlyerId(null);
    setDraft(nextDraft);
    draftRef.current = nextDraft;
    setSelectedElementId(null);
    if (campaign) {
      setElements(await defaultElements(nextDraft, campaign, resolveDraftQrUrl(nextDraft, campaign)));
    }
    setIsSettingsOpen(true);
    setMessage(null);
    setError(null);
  }

  async function openFlyer(flyer: CampaignFlyer) {
    const nextDraft = draftFromFlyer(flyer);
    setSelectedFlyerId(flyer.id);
    setDraft(nextDraft);
    draftRef.current = nextDraft;
    setSelectedElementId(null);
    if (campaign) {
      setElements(await elementsFromDraft(nextDraft, campaign, resolveDraftQrUrl(nextDraft, campaign)));
    }
    setMessage(null);
    setError(null);
  }

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        ...draftRef.current,
        layoutJson: createKonvaLayout(elementsRef.current),
      };
      const saved = draftRef.current.sourceFlyerId
        ? await updateCampaignFlyer(campaignId, draftRef.current.sourceFlyerId, payload)
        : await createCampaignFlyer(campaignId, payload);
      await reloadFlyers(saved.id);
      setMessage('Flyer saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save flyer.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    const flyerId = draftRef.current.sourceFlyerId;
    if (!flyerId) {
      return;
    }
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      await deleteCampaignFlyer(campaignId, flyerId);
      await reloadFlyers(null);
      setIsSettingsOpen(false);
      setMessage('Flyer deleted.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete flyer.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleDownloadPdf() {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    setIsExporting(true);
    setError(null);
    try {
      const dataUrl = stage.toDataURL({
        x: 0,
        y: 0,
        width: letterWidth,
        height: letterHeight,
        pixelRatio: 2,
        mimeType: 'image/png',
      });
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
      pdf.addImage(dataUrl, 'PNG', 0, 0, 612, 792);
      pdf.save(`${slugifyFlyerKey(draftRef.current.flyerKey || draftRef.current.name)}.pdf`);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Unable to export flyer PDF.');
    } finally {
      setIsExporting(false);
    }
  }

  async function handleInsertQr() {
    if (!qrUrl) {
      setError('Set a QR target before inserting the sponsor QR code.');
      return;
    }
    const src = await QRCode.toDataURL(qrUrl, { margin: 1, width: 420 });
    const element: FlyerImageElement = {
      id: createElementId(),
      type: 'image',
      src,
      x: letterWidth - 236,
      y: letterHeight - 314,
      width: 170,
      height: 170,
      altText: 'Sponsor QR code',
    };
    addElement(element);
  }

  function handleInsertLogo() {
    const element: FlyerImageElement = {
      id: createElementId(),
      type: 'image',
      src: `${window.location.origin}/blessing-tree-logo.png`,
      x: 66,
      y: 56,
      width: 92,
      height: 92,
      altText: 'Blessing Tree logo',
    };
    addElement(element);
  }

  function handleAddText() {
    addElement({
      id: createElementId(),
      type: 'text',
      text: 'Double-click to edit',
      x: 140,
      y: 180,
      width: 360,
      height: 64,
      fontSize: 34,
      fontFamily: 'Arial',
      fill: '#2d1544',
      align: 'left',
      lineHeight: 1.15,
    });
  }

  function handleUploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('Only image files can be uploaded.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        return;
      }
      addElement({
        id: createElementId(),
        type: 'image',
        src: reader.result,
        x: 500,
        y: 220,
        width: 240,
        height: 180,
        altText: file.name,
      });
    };
    reader.onerror = () => setError('Unable to read that image.');
    reader.readAsDataURL(file);
  }

  async function handleResetTemplate() {
    if (!campaign) {
      return;
    }
    const nextDraft = createBlankFlyerDraft(campaign);
    setDraft((currentDraft) => {
      const resetDraft = {
        ...currentDraft,
        headline: nextDraft.headline,
        subheadline: nextDraft.subheadline,
        bodyText: nextDraft.bodyText,
        callToAction: nextDraft.callToAction,
        contactInfo: nextDraft.contactInfo,
        layoutJson: nextDraft.layoutJson,
      };
      draftRef.current = resetDraft;
      return resetDraft;
    });
    setSelectedElementId(null);
    setElements(await defaultElements(nextDraft, campaign, qrUrl));
  }

  function addElement(element: FlyerElement) {
    setElements((currentElements) => [...currentElements, element]);
    setSelectedElementId(element.id);
  }

  function updateElement(elementId: string, patch: Partial<FlyerElement>) {
    setElements((currentElements) =>
      currentElements.map((element) =>
        element.id === elementId ? ({ ...element, ...patch } as FlyerElement) : element
      )
    );
  }

  function handleDuplicate() {
    if (!selectedElement) {
      return;
    }
    const duplicate = {
      ...selectedElement,
      id: createElementId(),
      x: selectedElement.x + 24,
      y: selectedElement.y + 24,
    } as FlyerElement;
    addElement(duplicate);
  }

  function handleDeleteSelected() {
    if (!selectedElementId) {
      return;
    }
    setElements((currentElements) => currentElements.filter((element) => element.id !== selectedElementId));
    setSelectedElementId(null);
  }

  function moveSelected(direction: 'forward' | 'backward') {
    if (!selectedElementId) {
      return;
    }
    setElements((currentElements) => {
      const index = currentElements.findIndex((element) => element.id === selectedElementId);
      const nextIndex = direction === 'forward' ? index + 1 : index - 1;
      if (index < 0 || nextIndex < 0 || nextIndex >= currentElements.length) {
        return currentElements;
      }
      const nextElements = [...currentElements];
      [nextElements[index], nextElements[nextIndex]] = [nextElements[nextIndex], nextElements[index]];
      return nextElements;
    });
  }

  function updateDraft(patch: Partial<FlyerDraft>) {
    setDraft((currentDraft) => {
      const nextDraft = {
        ...currentDraft,
        ...patch,
        flyerKey:
          'name' in patch && !currentDraft.sourceFlyerId
            ? slugifyFlyerKey(patch.name || currentDraft.name)
            : patch.flyerKey ?? currentDraft.flyerKey,
      };
      draftRef.current = nextDraft;
      return nextDraft;
    });
  }

  function openTextEditor(element: FlyerTextElement, node: Konva.Text) {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    node.hide();
    transformerRef.current?.hide();

    const stageBox = stage.container().getBoundingClientRect();
    const textPosition = node.absolutePosition();
    const scale = stage.scaleX();
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.value = element.text;
    textarea.style.position = 'absolute';
    textarea.style.top = `${stageBox.top + textPosition.y}px`;
    textarea.style.left = `${stageBox.left + textPosition.x}px`;
    textarea.style.width = `${Math.max(80, element.width * scale)}px`;
    textarea.style.minHeight = `${Math.max(40, element.height * scale)}px`;
    textarea.style.fontSize = `${element.fontSize * scale}px`;
    textarea.style.fontFamily = element.fontFamily;
    textarea.style.fontWeight = element.fontWeight ?? 'normal';
    textarea.style.fontStyle = element.fontStyle ?? 'normal';
    textarea.style.color = element.fill;
    textarea.style.lineHeight = String(element.lineHeight ?? 1.15);
    textarea.style.border = '1px solid #d4af37';
    textarea.style.padding = '4px';
    textarea.style.margin = '0';
    textarea.style.overflow = 'hidden';
    textarea.style.background = '#fffdf9';
    textarea.style.outline = 'none';
    textarea.style.resize = 'both';
    textarea.style.transformOrigin = 'left top';
    textarea.style.transform = `rotate(${element.rotation ?? 0}deg)`;
    textarea.focus();
    textarea.select();

    const finish = () => {
      updateElement(element.id, {
        text: textarea.value,
        width: Math.max(40, textarea.offsetWidth / scale),
        height: Math.max(20, textarea.offsetHeight / scale),
      });
      textarea.remove();
      node.show();
      transformerRef.current?.show();
      stage.batchDraw();
    };

    textarea.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        textarea.remove();
        node.show();
        transformerRef.current?.show();
        stage.batchDraw();
      }
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        finish();
      }
    });
    textarea.addEventListener('blur', finish, { once: true });
  }

  if (error && !campaign) {
    return (
      <section className="campaign-page-stack">
        <div className="alert alert-danger" role="alert">{error}</div>
      </section>
    );
  }

  if (!campaign) {
    return <p className="text-muted">Loading flyer builder...</p>;
  }

  const selectedText = selectedElement?.type === 'text' ? selectedElement : null;
  const stageScale = (zoom / 100) * editorBaseScale;
  const isExistingFlyer = Boolean(draft.sourceFlyerId);

  return (
    <section className="campaign-page-stack flyer-builder-page flyer-builder-page--konva">
      <div className="public-sponsor-flyer__actions">
        <Link to={buildCampaignStudioPath(campaign.id)} className="btn btn-outline-secondary btn-sm">
          <i className="bi bi-arrow-left-circle me-2" aria-hidden="true" />
          Back to Studio
        </Link>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setIsSettingsOpen(true)}>
          <i className="bi bi-sliders me-2" aria-hidden="true" />
          Flyer Settings
        </button>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleAddText}>
          <i className="bi bi-type me-2" aria-hidden="true" />
          Text
        </button>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => imageInputRef.current?.click()}>
          <i className="bi bi-image me-2" aria-hidden="true" />
          Image
        </button>
        <input ref={imageInputRef} type="file" accept="image/*" className="visually-hidden" onChange={handleUploadImage} />
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleInsertLogo}>
          <i className="bi bi-flower1 me-2" aria-hidden="true" />
          Logo
        </button>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => void handleInsertQr()}>
          <i className="bi bi-qr-code me-2" aria-hidden="true" />
          QR
        </button>
        <button type="button" className="btn btn-outline-secondary btn-sm" disabled={!selectedElement} onClick={handleDuplicate}>
          <i className="bi bi-copy me-2" aria-hidden="true" />
          Duplicate
        </button>
        <button type="button" className="btn btn-outline-danger btn-sm" disabled={!selectedElement} onClick={handleDeleteSelected}>
          <i className="bi bi-trash me-2" aria-hidden="true" />
          Delete
        </button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={isSaving} onClick={() => void handleSave()}>
          <i className="bi bi-floppy me-2" aria-hidden="true" />
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={isExporting} onClick={handleDownloadPdf}>
          <i className="bi bi-file-earmark-pdf me-2" aria-hidden="true" />
          {isExporting ? 'Creating PDF...' : 'PDF'}
        </button>
      </div>

      <div className="campaign-studio-page__header flyer-builder-page__header">
        <div>
          <div className="campaign-chip-row mb-3">
            <span className="campaign-chip campaign-chip-muted">{campaign.name}</span>
            <span className="campaign-chip campaign-chip-muted">Flyer Builder</span>
          </div>
          <h1 className="h3 mb-1">Flyer Builder</h1>
          <p className="text-muted mb-0">
            Double-click text to edit it, drag items around the page, resize with handles, and export the finished flyer as a PDF.
          </p>
        </div>
      </div>

      {error ? <div className="alert alert-danger" role="alert">{error}</div> : null}
      {message ? <div className="alert alert-success" role="status">{message}</div> : null}

      <div className="flyer-builder-konva-shell">
        <aside className="flyer-builder-library" aria-label="Saved flyers">
          <div className="flyer-builder-library__header">
            <h2 className="h6 mb-0">Flyers</h2>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => void openNewFlyer()}>
              <i className="bi bi-plus-lg me-1" aria-hidden="true" />
              New
            </button>
          </div>
          <div className="flyer-builder-library__list">
            {flyers.map((flyer) => (
              <button
                key={flyer.id}
                type="button"
                className={`flyer-builder-file ${flyer.id === selectedFlyerId ? 'is-selected' : ''}`}
                onClick={() => void openFlyer(flyer)}
              >
                <i className="bi bi-file-earmark-richtext" aria-hidden="true" />
                <span>
                  <strong>{flyer.name}</strong>
                  <small>{flyer.flyerType === 'SPONSOR_RECRUITMENT' ? 'Sponsor recruitment' : 'Custom flyer'}</small>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <div className="flyer-builder-konva-workspace">
          <div className="flyer-builder-konva-toolbar" aria-label="Canvas tools">
            <div className="flyer-builder-konva-toolbar__group">
              <button type="button" className="btn btn-outline-secondary btn-sm" disabled={!selectedElement} onClick={() => moveSelected('backward')}>
                <i className="bi bi-layer-backward me-1" aria-hidden="true" />
                Back
              </button>
              <button type="button" className="btn btn-outline-secondary btn-sm" disabled={!selectedElement} onClick={() => moveSelected('forward')}>
                <i className="bi bi-layer-forward me-1" aria-hidden="true" />
                Front
              </button>
            </div>

            {selectedText ? (
              <div className="flyer-builder-konva-toolbar__group">
                <button
                  type="button"
                  className={`btn btn-sm ${selectedText.fontWeight === 'bold' ? 'btn-secondary' : 'btn-outline-secondary'}`}
                  onClick={() => updateElement(selectedText.id, { fontWeight: selectedText.fontWeight === 'bold' ? 'normal' : 'bold' })}
                >
                  <i className="bi bi-type-bold" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${selectedText.fontStyle === 'italic' ? 'btn-secondary' : 'btn-outline-secondary'}`}
                  onClick={() => updateElement(selectedText.id, { fontStyle: selectedText.fontStyle === 'italic' ? 'normal' : 'italic' })}
                >
                  <i className="bi bi-type-italic" aria-hidden="true" />
                </button>
                <input
                  aria-label="Text color"
                  type="color"
                  className="form-control form-control-color form-control-sm"
                  value={selectedText.fill}
                  onChange={(event) => updateElement(selectedText.id, { fill: event.target.value })}
                />
                <input
                  aria-label="Font size"
                  type="number"
                  className="form-control form-control-sm flyer-builder-font-size"
                  min={8}
                  max={120}
                  value={selectedText.fontSize}
                  onChange={(event) => updateElement(selectedText.id, { fontSize: Number(event.target.value) || 18 })}
                />
              </div>
            ) : null}

            <label className="flyer-builder-zoom">
              <span>Zoom</span>
              <input type="range" min={45} max={120} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
              <strong>{zoom}%</strong>
            </label>
          </div>

          <div className="flyer-builder-konva-stage">
            <Stage
              ref={stageRef}
              width={letterWidth * stageScale}
              height={letterHeight * stageScale}
              scaleX={stageScale}
              scaleY={stageScale}
              onMouseDown={(event) => {
                if (event.target === event.target.getStage()) {
                  setSelectedElementId(null);
                }
              }}
              onTouchStart={(event) => {
                if (event.target === event.target.getStage()) {
                  setSelectedElementId(null);
                }
              }}
            >
              <Layer>
                <Rect x={0} y={0} width={letterWidth} height={letterHeight} fill={backgroundColor} listening={false} />
                {elements.map((element) => {
                  if (element.type === 'rect') {
                    return (
                      <Rect
                        key={element.id}
                        ref={(node) => {
                          nodeRefs.current[element.id] = node;
                        }}
                        {...element}
                        cornerRadius={element.cornerRadius}
                        draggable={!element.locked}
                        onClick={() => setSelectedElementId(element.id)}
                        onTap={() => setSelectedElementId(element.id)}
                        onDragEnd={(event) => updateElement(element.id, { x: event.target.x(), y: event.target.y() })}
                        onTransformEnd={(event) => updateTransformedElement(element, event.target)}
                      />
                    );
                  }
                  if (element.type === 'image') {
                    return (
                      <KonvaImage
                        key={element.id}
                        ref={(node) => {
                          nodeRefs.current[element.id] = node;
                        }}
                        image={loadedImages[element.id]}
                        x={element.x}
                        y={element.y}
                        width={element.width}
                        height={element.height}
                        rotation={element.rotation ?? 0}
                        draggable={!element.locked}
                        onClick={() => setSelectedElementId(element.id)}
                        onTap={() => setSelectedElementId(element.id)}
                        onDragEnd={(event) => updateElement(element.id, { x: event.target.x(), y: event.target.y() })}
                        onTransformEnd={(event) => updateTransformedElement(element, event.target)}
                      />
                    );
                  }
                  return (
                    <Text
                      key={element.id}
                      ref={(node) => {
                        nodeRefs.current[element.id] = node;
                      }}
                      {...element}
                      draggable={!element.locked}
                      onClick={() => setSelectedElementId(element.id)}
                      onTap={() => setSelectedElementId(element.id)}
                      onDblClick={(event) => openTextEditor(element, event.target as Konva.Text)}
                      onDblTap={(event) => openTextEditor(element, event.target as Konva.Text)}
                      onDragEnd={(event) => updateElement(element.id, { x: event.target.x(), y: event.target.y() })}
                      onTransformEnd={(event) => updateTransformedElement(element, event.target)}
                    />
                  );
                })}
                <Transformer
                  ref={transformerRef}
                  rotateEnabled
                  enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right']}
                  boundBoxFunc={(oldBox, newBox) => {
                    if (newBox.width < 16 || newBox.height < 16) {
                      return oldBox;
                    }
                    return newBox;
                  }}
                />
              </Layer>
            </Stage>
          </div>
        </div>
      </div>

      <CampaignStudioDrawer
        isOpen={isSettingsOpen}
        title={isExistingFlyer ? 'Flyer Settings' : 'New Flyer'}
        description="These settings control how the flyer is stored and what the QR button inserts."
        onClose={() => setIsSettingsOpen(false)}
        width="wide"
      >
        <div className="flyer-builder-settings-grid">
          <label className="form-label">
            Flyer Name
            <input className="form-control" value={draft.name} onChange={(event) => updateDraft({ name: event.target.value })} />
          </label>
          <label className="form-label">
            Flyer Key
            <input className="form-control" value={draft.flyerKey} onChange={(event) => updateDraft({ flyerKey: event.target.value })} />
          </label>
          <label className="form-label">
            Type
            <select className="form-select" value={draft.flyerType} onChange={(event) => updateDraft({ flyerType: event.target.value as FlyerDraft['flyerType'] })}>
              <option value="SPONSOR_RECRUITMENT">Sponsor recruitment</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </label>
          <label className="form-label">
            QR Target
            <select className="form-select" value={draft.qrTargetType} onChange={(event) => updateDraft({ qrTargetType: event.target.value as FlyerDraft['qrTargetType'] })}>
              <option value="PUBLIC_SPONSOR_SIGNUP">Public sponsor signup</option>
              <option value="CUSTOM_URL">Custom URL</option>
              <option value="NONE">No QR code</option>
            </select>
          </label>
          {draft.qrTargetType === 'CUSTOM_URL' ? (
            <label className="form-label flyer-builder-settings-grid__span-2">
              Custom QR URL
              <input className="form-control" value={draft.qrCustomUrl ?? ''} onChange={(event) => updateDraft({ qrCustomUrl: event.target.value || null })} />
            </label>
          ) : null}
          <label className="flyer-builder-toggle flyer-builder-settings-grid__span-2">
            <input type="checkbox" checked={draft.isActive} onChange={(event) => updateDraft({ isActive: event.target.checked })} />
            <span>Flyer is active and available to campaign staff.</span>
          </label>
        </div>
        <div className="d-flex flex-wrap gap-2 mt-4">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => void handleResetTemplate()}>
            <i className="bi bi-arrow-counterclockwise me-1" aria-hidden="true" />
            Reset Template
          </button>
          {isExistingFlyer ? (
            <button type="button" className="btn btn-outline-danger btn-sm" disabled={isSaving} onClick={() => void handleDelete()}>
              <i className="bi bi-trash me-1" aria-hidden="true" />
              Delete
            </button>
          ) : null}
          <button type="button" className="btn btn-secondary btn-sm" disabled={isSaving} onClick={() => void handleSave()}>
            <i className="bi bi-floppy me-1" aria-hidden="true" />
            {isExistingFlyer ? 'Save Flyer' : 'Create Flyer'}
          </button>
        </div>
      </CampaignStudioDrawer>
    </section>
  );

  function updateTransformedElement(element: FlyerElement, node: Konva.Node) {
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    updateElement(element.id, {
      x: node.x(),
      y: node.y(),
      width: Math.max(16, element.width * scaleX),
      height: Math.max(16, element.height * scaleY),
      rotation: node.rotation(),
    });
  }
}

async function defaultElements(draft: FlyerDraft, campaign: Campaign, qrUrl: string | null): Promise<FlyerElement[]> {
  const elements: FlyerElement[] = [
    {
      id: createElementId(),
      type: 'rect',
      x: 0,
      y: 0,
      width: letterWidth,
      height: 18,
      fill: '#d4af37',
      locked: true,
    },
    {
      id: createElementId(),
      type: 'image',
      src: `${window.location.origin}/blessing-tree-logo.png`,
      x: 66,
      y: 58,
      width: 92,
      height: 92,
      altText: 'Blessing Tree logo',
    },
    {
      id: createElementId(),
      type: 'text',
      text: campaign.name.toUpperCase(),
      x: 66,
      y: 178,
      width: 460,
      height: 30,
      fontSize: 20,
      fontWeight: 'bold',
      fontFamily: 'Arial',
      fill: '#6f5c45',
    },
    {
      id: createElementId(),
      type: 'text',
      text: draft.headline,
      x: 66,
      y: 228,
      width: 515,
      height: 138,
      fontSize: 52,
      fontWeight: 'bold',
      fontFamily: 'Arial',
      fill: '#2d1544',
      lineHeight: 1.05,
    },
    {
      id: createElementId(),
      type: 'text',
      text: draft.subheadline || campaign.seasonTheme || 'Blessing Tree Sponsor Invitation',
      x: 70,
      y: 384,
      width: 475,
      height: 58,
      fontSize: 24,
      fontFamily: 'Arial',
      fill: '#6f5c45',
    },
    {
      id: createElementId(),
      type: 'text',
      text: draft.bodyText,
      x: 70,
      y: 470,
      width: 450,
      height: 260,
      fontSize: 19,
      fontFamily: 'Arial',
      fill: '#34271e',
      lineHeight: 1.35,
    },
    {
      id: createElementId(),
      type: 'rect',
      x: 560,
      y: 200,
      width: 190,
      height: 250,
      fill: '#fbf4e3',
      stroke: '#d4af37',
      strokeWidth: 2,
      cornerRadius: 18,
    },
    {
      id: createElementId(),
      type: 'text',
      text: campaign.seasonTheme || 'Blessing Tree',
      x: 582,
      y: 294,
      width: 146,
      height: 90,
      fontSize: 25,
      fontWeight: 'bold',
      fontFamily: 'Arial',
      fill: '#2d1544',
      align: 'center',
    },
    {
      id: createElementId(),
      type: 'text',
      text: draft.callToAction,
      x: 548,
      y: 845,
      width: 220,
      height: 72,
      fontSize: 25,
      fontWeight: 'bold',
      fontFamily: 'Arial',
      fill: '#2d1544',
      align: 'center',
    },
  ];

  if (draft.contactInfo) {
    elements.push({
      id: createElementId(),
      type: 'text',
      text: draft.contactInfo,
      x: 70,
      y: 925,
      width: 420,
      height: 36,
      fontSize: 17,
      fontWeight: 'bold',
      fontFamily: 'Arial',
      fill: '#2d1544',
    });
  }

  if (qrUrl) {
    elements.push({
      id: createElementId(),
      type: 'image',
      src: await QRCode.toDataURL(qrUrl, { margin: 1, width: 420 }),
      x: 575,
      y: 635,
      width: 160,
      height: 160,
      altText: 'Sponsor QR code',
    });
  }

  return elements;
}

async function elementsFromDraft(draft: FlyerDraft, campaign: Campaign, qrUrl: string | null): Promise<FlyerElement[]> {
  const savedDesign = extractKonvaDesign(draft.layoutJson);
  if (savedDesign) {
    return savedDesign.elements;
  }
  return defaultElements(draft, campaign, qrUrl);
}

function extractKonvaDesign(value?: Record<string, unknown> | null): KonvaFlyerDesign | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  if (value.editor !== 'konva' || !value.design || typeof value.design !== 'object') {
    return null;
  }
  const design = value.design as Partial<KonvaFlyerDesign>;
  if (!Array.isArray(design.elements)) {
    return null;
  }
  return {
    editor: 'konva',
    version: 1,
    width: Number(design.width) || letterWidth,
    height: Number(design.height) || letterHeight,
    elements: design.elements.filter(isFlyerElement),
  };
}

function createKonvaLayout(elements: FlyerElement[]): Record<string, unknown> {
  return {
    editor: 'konva',
    design: {
      editor: 'konva',
      version: 1,
      width: letterWidth,
      height: letterHeight,
      elements,
    },
  };
}

function isFlyerElement(value: unknown): value is FlyerElement {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const element = value as Partial<FlyerElement>;
  return typeof element.id === 'string' && ['text', 'image', 'rect'].includes(String(element.type));
}

function createBlankFlyerDraft(campaign?: Campaign): FlyerDraft {
  const name = 'Sponsor Recruitment Flyer';
  return {
    flyerKey: 'sponsor_recruitment',
    name,
    flyerType: 'SPONSOR_RECRUITMENT',
    headline: campaign ? `Sponsor a Gift for ${campaign.name}` : 'Sponsor a Gift',
    subheadline: campaign?.seasonTheme ?? 'Blessing Tree Sponsor Invitation',
    bodyText:
      'Help make this campaign possible by sponsoring gifts from a recipient wishlist.\n\nChoose gifts online, verify your email, and bring the gifts back by the campaign deadline.',
    callToAction: 'Scan to choose gifts',
    contactInfo: null,
    qrTargetType: 'PUBLIC_SPONSOR_SIGNUP',
    qrCustomUrl: null,
    themeMode: 'CAMPAIGN_PURPOSE',
    imagePrompt: campaign?.seasonTheme ?? null,
    layoutJson: { editor: 'konva' },
    isActive: true,
    sourceFlyerId: null,
  };
}

function createUniqueFlyerDraft(campaign: Campaign | undefined, existingFlyers: CampaignFlyer[]): FlyerDraft {
  const draft = createBlankFlyerDraft(campaign);
  const existingKeys = new Set(existingFlyers.map((flyer) => flyer.flyerKey));
  const existingNames = new Set(existingFlyers.map((flyer) => flyer.name.trim().toLowerCase()));
  let suffix = existingFlyers.length + 1;
  let nextName = `Sponsor Recruitment Flyer ${suffix}`;
  let nextKey = slugifyFlyerKey(nextName);

  while (existingKeys.has(nextKey) || existingNames.has(nextName.trim().toLowerCase())) {
    suffix += 1;
    nextName = `Sponsor Recruitment Flyer ${suffix}`;
    nextKey = slugifyFlyerKey(nextName);
  }

  return {
    ...draft,
    name: nextName,
    flyerKey: nextKey,
    sourceFlyerId: null,
  };
}

function resolveDraftQrUrl(draft: FlyerDraft, campaign: Campaign): string | null {
  if (draft.qrTargetType === 'CUSTOM_URL') {
    return draft.qrCustomUrl;
  }
  if (draft.qrTargetType !== 'PUBLIC_SPONSOR_SIGNUP' || !campaign.publicSponsorSlug) {
    return null;
  }
  return `${window.location.origin}${buildPublicCampaignSponsorPath(campaign.publicSponsorSlug)}`;
}

function draftFromFlyer(flyer: CampaignFlyer): FlyerDraft {
  return {
    flyerKey: flyer.flyerKey,
    name: flyer.name,
    flyerType: flyer.flyerType,
    headline: flyer.headline,
    subheadline: flyer.subheadline,
    bodyText: flyer.bodyText,
    callToAction: flyer.callToAction,
    contactInfo: flyer.contactInfo,
    qrTargetType: flyer.qrTargetType,
    qrCustomUrl: flyer.qrCustomUrl,
    themeMode: flyer.themeMode,
    imagePrompt: flyer.imagePrompt,
    layoutJson: flyer.layoutJson,
    isActive: flyer.isActive,
    sourceFlyerId: flyer.id,
  };
}

function createElementId(): string {
  return crypto.randomUUID();
}

function slugifyFlyerKey(value: string): string {
  const key = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return key || 'flyer';
}
