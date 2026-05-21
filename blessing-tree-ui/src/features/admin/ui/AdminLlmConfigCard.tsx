import { useEffect, useState } from 'react';
import {
  fetchAdminLlmConfig,
  saveAdminLlmConfig,
  testAdminLlmConfig,
} from '@/features/admin/api/adminApi';
import {
  CUSTOM_MODEL_VALUE,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_OPENAI_BASE_URL,
  getOpenAiModelSelectValue,
  getProviderBaseUrl,
  isOpenAiProvider,
  OPENAI_PROVIDER,
  OPENAI_MODEL_PRESETS,
} from '@/features/admin/model/adminLlmForm';
import type { AdminLlmPayload } from '@/features/admin/model/adminTypes';

export function AdminLlmConfigCard() {
  const [payload, setPayload] = useState<AdminLlmPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const nextPayload = await fetchAdminLlmConfig();
        if (active) {
          setPayload(nextPayload);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load LLM configuration.');
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (isLoading) {
    return <div className="content-card">Loading LLM configuration...</div>;
  }

  if (!payload) {
    return <div className="content-card">Unable to load LLM configuration.</div>;
  }

  const { configuration, providerCatalog } = payload;
  const showOpenAiPresets = isOpenAiProvider(configuration.provider);
  const openAiModelSelectValue = getOpenAiModelSelectValue(configuration.model);
  const showCustomOpenAiModel = showOpenAiPresets && openAiModelSelectValue === CUSTOM_MODEL_VALUE;

  const save = async () => {
    setIsSaving(true);
    setMessage(null);
    setError(null);
    try {
      const nextConfiguration = await saveAdminLlmConfig({
        provider: configuration.provider,
        label: configuration.label,
        baseUrl: getProviderBaseUrl(configuration.provider, configuration.baseUrl),
        model: configuration.model,
        apiKey,
        isEnabled: configuration.isEnabled,
      });
      setPayload({ ...payload, configuration: nextConfiguration });
      setApiKey('');
      setMessage('LLM configuration saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save LLM configuration.');
    } finally {
      setIsSaving(false);
    }
  };

  const test = async () => {
    setIsSaving(true);
    setMessage(null);
    setError(null);
    try {
      const result = await testAdminLlmConfig();
      setMessage(result.message ?? 'LLM connection test complete.');
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : 'Unable to test LLM configuration.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="content-card h-100">
      <h2 className="h5 mb-1">LLM Configuration</h2>
      <p className="text-muted mb-3">
        Configure the global LLM used for Blessing Tree AI drafting and health checks.
      </p>
      {message ? <div className="alert alert-success py-2">{message}</div> : null}
      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      <div className="row g-3">
        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor="admin-llm-label">
            Label
          </label>
          <input
            id="admin-llm-label"
            className="form-control"
            value={configuration.label}
            onChange={(event) =>
              setPayload({
                ...payload,
                configuration: { ...configuration, label: event.target.value },
              })
            }
          />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor="admin-llm-provider">
            Provider
          </label>
          <select
            id="admin-llm-provider"
            className="form-select"
            value={configuration.provider}
            onChange={(event) =>
              setPayload({
                ...payload,
                configuration: {
                  ...configuration,
                  provider: event.target.value,
                  baseUrl:
                    event.target.value === OPENAI_PROVIDER
                      ? DEFAULT_OPENAI_BASE_URL
                      : configuration.baseUrl,
                  model:
                    event.target.value === OPENAI_PROVIDER && !configuration.model
                      ? DEFAULT_OPENAI_MODEL
                      : configuration.model,
                },
              })
            }
          >
            {providerCatalog.map((provider) => (
              <option key={provider.provider} value={provider.provider}>
                {provider.label}
              </option>
            ))}
          </select>
        </div>
        {showOpenAiPresets ? (
          <div className="col-12">
            <label className="form-label">Endpoint</label>
            <div className="form-control bg-light text-muted">Using the default OpenAI API endpoint</div>
            <div className="form-text">{DEFAULT_OPENAI_BASE_URL}</div>
          </div>
        ) : (
          <div className="col-12">
            <label className="form-label" htmlFor="admin-llm-base-url">
              Base URL
            </label>
            <input
              id="admin-llm-base-url"
              className="form-control"
              value={configuration.baseUrl}
              onChange={(event) =>
                setPayload({
                  ...payload,
                  configuration: { ...configuration, baseUrl: event.target.value },
                })
              }
              placeholder="https://example-llm.company.com/v1"
            />
          </div>
        )}
        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor="admin-llm-model">
            Model
          </label>
          {showOpenAiPresets ? (
            <>
              <select
                id="admin-llm-model"
                className="form-select"
                value={openAiModelSelectValue}
                onChange={(event) =>
                  setPayload({
                    ...payload,
                    configuration: {
                      ...configuration,
                      model:
                        event.target.value === CUSTOM_MODEL_VALUE
                          ? ''
                          : event.target.value,
                    },
                  })
                }
              >
                {OPENAI_MODEL_PRESETS.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
                <option value={CUSTOM_MODEL_VALUE}>Custom model</option>
              </select>
              {showCustomOpenAiModel ? (
                <input
                  id="admin-llm-model-custom"
                  className="form-control mt-2"
                  value={configuration.model}
                  onChange={(event) =>
                    setPayload({
                      ...payload,
                      configuration: { ...configuration, model: event.target.value },
                    })
                  }
                  placeholder="Enter custom OpenAI model"
                />
              ) : null}
            </>
          ) : (
            <input
              id="admin-llm-model"
              className="form-control"
              value={configuration.model}
              onChange={(event) =>
                setPayload({
                  ...payload,
                  configuration: { ...configuration, model: event.target.value },
                })
              }
              placeholder="gpt-4o-mini"
            />
          )}
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor="admin-llm-api-key">
            API Key
          </label>
          <input
            id="admin-llm-api-key"
            className="form-control"
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={configuration.apiKeyConfigured ? 'Stored key configured' : 'Paste API key'}
          />
        </div>
        <div className="col-12">
          <div className="form-check form-switch">
            <input
              id="admin-llm-enabled"
              className="form-check-input"
              type="checkbox"
              checked={configuration.isEnabled}
              onChange={(event) =>
                setPayload({
                  ...payload,
                  configuration: { ...configuration, isEnabled: event.target.checked },
                })
              }
            />
            <label className="form-check-label" htmlFor="admin-llm-enabled">
              Enable this LLM configuration
            </label>
          </div>
        </div>
      </div>
      <div className="d-flex flex-wrap gap-2 mt-4">
        <button type="button" className="btn btn-primary btn-sm" disabled={isSaving} onClick={() => void save()}>
          Save LLM Settings
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          disabled={isSaving}
          onClick={() => void test()}
        >
          Test Connection
        </button>
      </div>
    </div>
  );
}
