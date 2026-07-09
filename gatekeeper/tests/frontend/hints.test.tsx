/**
 * @jest-environment jsdom
 *
 * Unit tests for the Hints ("Mimir's Counsel") panel. Guards two things that
 * broke on the live landing page: the panel must not default to the internal
 * sample realm, and a realm with no hints must degrade gracefully rather than
 * showing a hard error.
 */
import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import { Hints } from '../../frontend/src/components/Hints';
import { getProductionRealms, REALMS_METADATA } from '../../src/config/realms-metadata';

const mockUseRealmsSorted = jest.fn();

jest.mock('../../frontend/src/hooks/useRealms', () => ({
  useRealmsSorted: () => mockUseRealmsSorted(),
}));

// All realms, sorted descending by order (entry realm Niflheim first, sample realm last)
function allRealmsSortedDesc() {
  return [...REALMS_METADATA]
    .sort((a, b) => b.order - a.order)
    .map((r) => ({
      name: r.name,
      displayName: r.displayName,
      description: r.description,
      order: r.order,
      locked: false,
      theme: { ...r.theme },
    }));
}

describe('Hints panel', () => {
  beforeEach(() => {
    mockUseRealmsSorted.mockReturnValue({ realms: allRealmsSortedDesc(), loading: false });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        realm: 'NIFLHEIM',
        basePoints: 100,
        hintsRevealed: 0,
        totalHints: 3,
        potentialPoints: 100,
        hints: [
          { order: 1, revealed: false },
          { order: 2, revealed: false },
          { order: 3, revealed: false },
        ],
      }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => jest.restoreAllMocks());

  it('excludes the sample realm from the selector', () => {
    render(<Hints />);
    const select = screen.getByLabelText(/realm/i);
    expect(within(select).queryByText('Sample Realm')).toBeNull();
    // All ten production realms are offered
    expect(within(select).getAllByRole('option')).toHaveLength(getProductionRealms().length);
  });

  it('defaults to the entry realm (Niflheim) and loads its hints, not the sample realm', async () => {
    render(<Hints />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const firstUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(firstUrl).toBe('/realms/niflheim/hints');
    expect(firstUrl).not.toContain('sample');
    await waitFor(() => expect(screen.getByText(/Revealed 0\/3/)).toBeInTheDocument());
  });

  it('shows a graceful message (not a hard error) when a realm has no hints', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ status: 'error', message: 'No hints for this realm' }),
    });
    render(<Hints />);
    await waitFor(() =>
      expect(screen.getByText(/no hints available for this realm yet/i)).toBeInTheDocument()
    );
    expect(screen.queryByText(/failed to load hints/i)).toBeNull();
  });
});
