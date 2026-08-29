/**
 * @jest-environment jsdom
 *
 * Unit tests for the ScopeBanner: the rules-of-engagement notice that a
 * publicly hosted instance shows and a local one does not.
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { ScopeBanner, isHostedOrigin } from '../../frontend/src/components/ScopeBanner';

function setLocation(href: string) {
  const url = new URL(href);
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { hostname: url.hostname, origin: url.origin, href: url.href },
  });
}

describe('isHostedOrigin', () => {
  it.each(['localhost', '127.0.0.1', '0.0.0.0', '::1', 'ygg.localhost', 'box.local'])(
    'treats %s as local',
    (hostname) => {
      expect(isHostedOrigin(hostname)).toBe(false);
    }
  );

  it.each(['play.example.test', 'yggdrasil.example.com', '203.0.113.10'])(
    'treats %s as hosted',
    (hostname) => {
      expect(isHostedOrigin(hostname)).toBe(true);
    }
  );
});

describe('ScopeBanner', () => {
  it('renders nothing during local play', () => {
    setLocation('http://localhost:8080/');
    const { container } = render(<ScopeBanner />);

    expect(container).toBeEmptyDOMElement();
  });

  it('names the current origin as the only target', () => {
    setLocation('https://play.example.test/');
    render(<ScopeBanner />);

    expect(screen.getByText(/https:\/\/play\.example\.test/)).toBeInTheDocument();
    expect(screen.getByText(/and nothing else/i)).toBeInTheDocument();
  });

  it('calls out transit providers and other players as out of scope', () => {
    setLocation('https://play.example.test/');
    render(<ScopeBanner />);

    const region = screen.getByRole('region', { name: /rules of engagement/i });
    expect(region).toHaveTextContent(/Cloudflare/);
    expect(region).toHaveTextContent(/other players/);
    expect(region).toHaveTextContent(/denial-of-service/i);
  });

  it('links to the published security.txt', () => {
    setLocation('https://play.example.test/');
    render(<ScopeBanner />);

    expect(screen.getByRole('link', { name: /full scope and contact/i })).toHaveAttribute(
      'href',
      '/.well-known/security.txt'
    );
  });
});
