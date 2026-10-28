import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEMO_GAME } from '@/data/demoGame';
import { CoverArt } from './CoverArt';
import { ScreenshotCarousel } from './ScreenshotCarousel';

afterEach(() => {
  vi.restoreAllMocks();
  delete (Element.prototype as { scrollBy?: unknown }).scrollBy;
});

describe('CoverArt', () => {
  it('renders the stored cover when available', () => {
    render(<CoverArt game={{ ...DEMO_GAME, coverUrl: 'https://example.test/cover.webp' }} />);

    expect(screen.getByAltText('Gothicvania cover')).toBeInTheDocument();
  });

  it('falls back to the gradient placeholder when the image fails', () => {
    render(<CoverArt game={{ ...DEMO_GAME, coverUrl: 'https://example.test/broken.webp' }} />);

    fireEvent.error(screen.getByAltText('Gothicvania cover'));

    expect(screen.queryByAltText('Gothicvania cover')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: /placeholder cover/i })).toBeInTheDocument();
  });

  it('renders the placeholder when no cover is stored', () => {
    render(<CoverArt game={DEMO_GAME} />);

    expect(screen.getByRole('img', { name: /placeholder cover/i })).toBeInTheDocument();
  });
});

describe('ScreenshotCarousel', () => {
  it('renders stored screenshots', () => {
    render(<ScreenshotCarousel screenshots={['https://example.test/s1.webp']} title="Gothicvania" />);

    expect(screen.getByAltText('Gothicvania screenshot 1')).toBeInTheDocument();
  });

  it('falls back to placeholders when every image fails', () => {
    render(<ScreenshotCarousel screenshots={['https://example.test/broken.webp']} title="Gothicvania" />);

    fireEvent.error(screen.getByAltText('Gothicvania screenshot 1'));

    expect(screen.queryByAltText('Gothicvania screenshot 1')).not.toBeInTheDocument();
    expect(screen.getAllByText('No screenshot')).toHaveLength(3);
  });

  it('navigates with keyboard-accessible previous/next controls', async () => {
    const scrollBy = vi.fn();
    (Element.prototype as { scrollBy?: unknown }).scrollBy = scrollBy;
    const user = userEvent.setup();

    render(
      <ScreenshotCarousel
        screenshots={['https://example.test/one.webp', 'https://example.test/two.webp']}
        title="Gothicvania"
      />,
    );

    const next = screen.getByRole('button', { name: 'Next screenshot' });
    next.focus();
    expect(next).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(scrollBy).toHaveBeenCalledWith(
      expect.objectContaining({ left: expect.any(Number), behavior: 'smooth' }),
    );

    await user.click(screen.getByRole('button', { name: 'Previous screenshot' }));
    expect(scrollBy).toHaveBeenCalledTimes(2);
  });
});
