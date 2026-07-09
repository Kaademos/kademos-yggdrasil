/**
 * @jest-environment jsdom
 *
 * Unit tests for the landing page Hero: World Tree artwork, OWASP 2025
 * badge, ten-realms copy, and the CTA wiring.
 */
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { Hero } from '../../frontend/src/components/Hero';

describe('Hero', () => {
  it('renders the World Tree hero artwork', () => {
    render(<Hero onCTAClick={jest.fn()} />);
    const image = screen.getByAltText('Yggdrasil - The World Tree');
    expect(image).toHaveAttribute('src', '/assets/yggdrasil-hero.webp');
  });

  it('renders the headline and the OWASP Top 10 • 2025 badge', () => {
    render(<Hero onCTAClick={jest.fn()} />);
    expect(screen.getByText('THE TREE IS ROTTING.')).toBeInTheDocument();
    expect(screen.getByText('OWASP Top 10 • 2025')).toBeInTheDocument();
  });

  it('refers to the Ten Realms, never nine', () => {
    const { container } = render(<Hero onCTAClick={jest.fn()} />);
    expect(screen.getByText(/journey through the Ten Realms/i)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/nine realms/i);
  });

  it('invokes the CTA callback when the ascension button is clicked', () => {
    const onCTAClick = jest.fn();
    render(<Hero onCTAClick={onCTAClick} />);
    fireEvent.click(screen.getByRole('button', { name: /begin yggdrasil challenge/i }));
    expect(onCTAClick).toHaveBeenCalledTimes(1);
  });
});
