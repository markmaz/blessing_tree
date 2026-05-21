import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminLlmConfigCard } from '@/features/admin/ui/AdminLlmConfigCard';
import {
  fetchAdminLlmConfig,
  saveAdminLlmConfig,
  testAdminLlmConfig,
} from '@/features/admin/api/adminApi';

vi.mock('@/features/admin/api/adminApi', () => ({
  fetchAdminLlmConfig: vi.fn(),
  saveAdminLlmConfig: vi.fn(),
  testAdminLlmConfig: vi.fn(),
}));

describe('AdminLlmConfigCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchAdminLlmConfig).mockResolvedValue({
      configuration: {
        configured: true,
        provider: 'OPENAI',
        label: 'Primary LLM',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4.1-mini',
        apiKeyConfigured: true,
        isEnabled: true,
        lastTestedAt: null,
        lastTestStatus: null,
        lastTestMessage: null,
      },
      providerCatalog: [
        { provider: 'OPENAI', label: 'OpenAI', description: 'Direct OpenAI API endpoint.' },
        {
          provider: 'OPENAI_COMPATIBLE',
          label: 'OpenAI-Compatible',
          description: 'Generic compatible endpoint.',
        },
      ],
    });
    vi.mocked(saveAdminLlmConfig).mockResolvedValue({
      configured: true,
      provider: 'OPENAI',
      label: 'Primary LLM',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4.1-mini',
      apiKeyConfigured: true,
      isEnabled: true,
      lastTestedAt: null,
      lastTestStatus: null,
      lastTestMessage: null,
    });
    vi.mocked(testAdminLlmConfig).mockResolvedValue({
      status: 'ok',
      message: 'LLM connection succeeded.',
    });
  });

  it('shows OpenAI presets and hides the raw base url field for OpenAI', async () => {
    render(<AdminLlmConfigCard />);

    expect(await screen.findByText(/llm configuration/i)).toBeInTheDocument();
    expect(screen.getByText(/using the default openai api endpoint/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^base url$/i)).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /model/i })).toHaveValue('gpt-4.1-mini');
  });

  it('sends the default OpenAI base url on save', async () => {
    const user = userEvent.setup();
    render(<AdminLlmConfigCard />);

    expect(await screen.findByText(/llm configuration/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /save llm settings/i }));

    await waitFor(() => {
      expect(saveAdminLlmConfig).toHaveBeenCalledWith({
        provider: 'OPENAI',
        label: 'Primary LLM',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4.1-mini',
        apiKey: '',
        isEnabled: true,
      });
    });
  });

  it('shows editable base url and freeform model for OpenAI-compatible providers', async () => {
    const user = userEvent.setup();
    render(<AdminLlmConfigCard />);

    expect(await screen.findByText(/llm configuration/i)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/provider/i), 'OPENAI_COMPATIBLE');

    expect(screen.getByLabelText(/^base url$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^model$/i)).toHaveAttribute('placeholder', 'gpt-4o-mini');
  });
});
