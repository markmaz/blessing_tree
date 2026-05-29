import { useState } from 'react';
import { askBlessingTree } from '@/features/ask/api/askApi';
import type { AskRequestContext, AskResponse } from '@/features/ask/model/askTypes';
import '@/features/ask/ui/ask.css';

interface FieldHelpButtonProps {
  campaignId?: string | null;
  screen: string;
  fieldName: string;
  fieldLabel?: string;
  route?: string;
}

export function FieldHelpButton({ campaignId, screen, fieldName, fieldLabel, route }: FieldHelpButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const label = fieldLabel ?? fieldName;

  if (!campaignId) {
    return null;
  }

  async function openHelp() {
    if (!campaignId) {
      return;
    }
    setIsOpen(true);
    if (response || isLoading) {
      return;
    }
    setIsLoading(true);
    setError(null);
    const context: AskRequestContext = {
      screen,
      fieldName,
      fieldLabel: label,
      route,
    };
    try {
      const result = await askBlessingTree(campaignId, 'What should I put here?', context);
      setResponse(result);
    } catch (helpError) {
      setError(helpError instanceof Error ? helpError.message : 'Unable to load field help.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-link field-help-button"
        aria-label={`Ask Blessing Tree about ${label}`}
        title={`Ask Blessing Tree about ${label}`}
        onClick={openHelp}
      >
        <i className="bi bi-question-circle" aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className="field-help-modal" role="dialog" aria-modal="true" aria-labelledby="field-help-modal-title">
          <div className="field-help-modal__backdrop" onClick={() => setIsOpen(false)} />
          <div className="field-help-modal__panel">
            <div className="field-help-modal__header">
              <div>
                <div className="field-help-modal__eyebrow">Ask Blessing Tree</div>
                <h2 id="field-help-modal-title" className="h6 mb-0">
                  {label}
                </h2>
              </div>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                aria-label="Close field help"
                onClick={() => setIsOpen(false)}
              >
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>

            <div className="field-help-modal__body">
              <div className="field-help-modal__prompt">What should I put here?</div>
              {isLoading ? (
                <div className="field-help-modal__answer text-muted">
                  <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                  Asking Blessing Tree...
                </div>
              ) : error ? (
                <div className="alert alert-danger py-2 mb-0">{error}</div>
              ) : response ? (
                <div className="field-help-modal__answer">
                  {response.title ? <h3 className="h6 mb-2">{response.title}</h3> : null}
                  <p className="mb-0">{response.answer}</p>
                  {response.sources.length > 0 ? (
                    <div className="field-help-modal__source">
                      From {response.sources[0].document}: {response.sources[0].title}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
