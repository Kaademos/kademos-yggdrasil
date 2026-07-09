/**
 * @jest-environment jsdom
 *
 * Unit tests for the RealmMap "ascent" layout. Mock realms are derived from
 * the backend metadata (the single source of truth) so the component is
 * always exercised against the real ten-realm OWASP 2025 mapping.
 */
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import { RealmMap } from '../../frontend/src/components/RealmMap';
import { Realm } from '../../frontend/src/types/realm';
import { getProductionRealms } from '../../src/config/realms-metadata';

const mockUseProductionRealms = jest.fn();

jest.mock('../../frontend/src/hooks/useRealms', () => ({
  useProductionRealms: () => mockUseProductionRealms(),
}));

/** Realms as the /realms API would serve them: only Niflheim (entry) unlocked */
function buildRealms(): Realm[] {
  return getProductionRealms().map((r) => ({
    name: r.name,
    displayName: r.displayName,
    description: r.description,
    order: r.order,
    locked: r.order !== 10,
    theme: { ...r.theme },
  }));
}

describe('RealmMap', () => {
  beforeEach(() => {
    mockUseProductionRealms.mockReturnValue({
      realms: buildRealms(),
      loading: false,
      error: null,
    });
  });

  it('renders the Ten Realms heading', () => {
    render(<RealmMap />);
    expect(screen.getByRole('heading', { name: /the ten realms/i })).toBeInTheDocument();
  });

  it('renders all ten realm nodes', () => {
    render(<RealmMap />);
    const ascent = screen.getByTestId('realm-ascent');
    expect(within(ascent).getAllByTestId(/^realm-node-/)).toHaveLength(10);
  });

  it('orders the ascent with Asgard at the top and Niflheim at the roots', () => {
    render(<RealmMap />);
    const nodes = screen.getAllByTestId(/^realm-node-/);
    expect(nodes[0]).toHaveAttribute('data-testid', 'realm-node-asgard');
    expect(nodes[nodes.length - 1]).toHaveAttribute('data-testid', 'realm-node-niflheim');
  });

  it('links the unlocked entry realm and renders locked realms without links', () => {
    render(<RealmMap />);

    const niflheim = screen.getByTestId('realm-node-niflheim');
    const entryLink = within(niflheim).getByRole('link');
    expect(entryLink).toHaveAttribute('href', '/realms/niflheim/');

    const asgard = screen.getByTestId('realm-node-asgard');
    expect(within(asgard).queryByRole('link')).toBeNull();
    expect(within(asgard).getByText('CLASSIFIED')).toBeInTheDocument();
  });

  it('renders each realm emblem icon', () => {
    render(<RealmMap />);
    for (const realm of buildRealms()) {
      expect(
        screen.getByRole('img', { name: `${realm.displayName} emblem` })
      ).toHaveTextContent(realm.theme.icon.trim());
    }
  });

  it('shows each realm OWASP category', () => {
    render(<RealmMap />);
    for (const realm of buildRealms()) {
      expect(screen.getByText(realm.theme.category)).toBeInTheDocument();
    }
  });

  it('shows a loading skeleton while realms are being fetched', () => {
    mockUseProductionRealms.mockReturnValue({ realms: [], loading: true, error: null });
    const { container } = render(<RealmMap />);
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
  });

  it('shows an error message when the fetch fails', () => {
    mockUseProductionRealms.mockReturnValue({
      realms: [],
      loading: false,
      error: new Error('boom'),
    });
    render(<RealmMap />);
    expect(screen.getByText(/failed to load realms/i)).toBeInTheDocument();
  });
});
