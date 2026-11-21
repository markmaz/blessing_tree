import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CampaignStudioTemplatePreviewPanel } from './CampaignStudioTemplatePreviewPanel';

describe('template gift-list preview', () => {
  it('shows a multi-person gift list as spaced body text even in a heading block', () => {
    render(<CampaignStudioTemplatePreviewPanel subjectTemplate="Your gifts" blocks={[
      { id: 'title', type: 'heading', content: 'Thank you' },
      { id: 'gifts', type: 'heading', content: '{{gift.items_list}}' },
    ]} />);
    expect(screen.getByRole('heading', { name: 'Thank you' })).toBeInTheDocument();
    const giftList = screen.getByText(/Age: 8 years; Gender: Female/);
    expect(giftList.tagName).toBe('P');
    expect(giftList).toHaveClass('campaign-template-preview-card__text-block');
    expect(giftList.textContent).toContain('\n\nBT-002');
    expect(giftList.textContent).toContain('• Winter coat; Size: Youth M');
  });
});
