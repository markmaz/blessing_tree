import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { GiftSearchPage } from './GiftSearchPage';
import { makeGift } from '@/features/gifts/model/giftSearchTable.testFixtures';

vi.mock('@/features/campaigns/model/campaignContext', () => ({
  useCampaigns: () => ({ campaigns: [{id: 'c', name: 'Campaign'}], selectedCampaignId: 'c', selectCampaign: vi.fn() }),
}));
vi.mock('@/features/gifts/api/giftSearchApi', () => ({
  searchCampaignGifts: async () => ({ campaignId: 'c', count: 30,
    parsedFilters: { query: '', terms: [], item_types: [], warnings: [], age_min: null, age_max: null, gender: null, categories: [], sizes: [], min_cost_cents: null, max_cost_cents: null },
    items: Array.from({length:30}, (_, i) => makeGift(i+1, i % 2 === 0)) }),
}));
vi.mock('@/features/campaigns/api/campaignSponsorWorkspaceApi', () => ({ getCampaignSponsorWorkspace: async () => ({sponsors: []}) }));
vi.mock('@/features/reports/ui/ReportExportActions', () => ({ ReportExportActions: () => null }));

describe('GiftSearchPage table controls', () => {
  it('sorts headers and filters availability while resetting pagination', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/campaigns/c/gifts/search']}><Routes>
      <Route path="/campaigns/:campaignId/gifts/search" element={<GiftSearchPage />} />
    </Routes></MemoryRouter>);
    await screen.findByText('Gift 1');
    await user.click(screen.getByRole('button', {name:'Next page'}));
    expect(screen.getByRole('button', {name:'Page 2 of 2'})).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name:'Available'}));
    expect(screen.getByRole('button', {name:'Page 1 of 1'})).toBeInTheDocument();
    expect(screen.queryByText('Gift 2')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', {name:'Sort Gift'}));
    await user.click(screen.getByRole('button', {name:'Sort Gift'}));
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Gift 29');
    expect(screen.getByRole('columnheader',{name:'Gift'})).toHaveAttribute('aria-sort','descending');
    await user.click(screen.getByRole('button', {name:'Unavailable'}));
    expect(screen.queryByText('Gift 1')).not.toBeInTheDocument();
    expect(screen.getByText('Gift 2')).toBeInTheDocument();
  });
});
