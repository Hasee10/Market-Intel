import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Reveal } from './Reveal';

// Reveal decides whether content is visible in the *server-rendered* HTML,
// which is the whole reason this test renders rather than mounts.
//
// The bug it guards: Reveal used to start every block at opacity 0 and only
// reveal it once React had mounted, hydrated, and an IntersectionObserver had
// fired. The landing hero wraps six stacked blocks in it, so the entire first
// screen was invisible until client JS ran - a blank flash on a slow
// connection, and a permanently blank hero if hydration failed. That page has
// a recorded history of hydration errors, so this is not hypothetical.
//
// `immediate` is the fix: above-the-fold content ships visible in the server
// HTML and the entrance animation becomes pure CSS decoration that needs no
// JavaScript at all.

const HIDDEN_CLASS = 'reveal-pending';

describe('Reveal', () => {
  it('ships content visible in the server HTML when immediate is set', () => {
    const html = renderToStaticMarkup(
      createElement(Reveal, { immediate: true }, createElement('p', null, 'above the fold')),
    );

    expect(html).toContain('above the fold');
    expect(html).not.toContain(HIDDEN_CLASS);
    // The contract, stated independently of how hiding is implemented. Before
    // the fix the server HTML carried a literal `.css-xxx{opacity:0;}` style
    // tag from Emotion, so this is the assertion that actually failed.
    expect(html).not.toContain('opacity:0');
  });

  // Guards against the test above passing vacuously: if the hidden state were
  // deleted outright, `not.toContain` would still pass while every
  // below-the-fold entrance animation had silently stopped working.
  it('still hides non-immediate content pre-JS, so the entrance can play on scroll', () => {
    const html = renderToStaticMarkup(
      createElement(Reveal, null, createElement('p', null, 'below the fold')),
    );

    expect(html).toContain('below the fold');
    expect(html).toContain(HIDDEN_CLASS);
  });

  // Chakra style props (h="100%") were valid on the old Box-based Reveal and
  // become invalid DOM attributes on a plain div. The four call sites that
  // used them moved to className="h-full"; this pins the className pass-through
  // they now depend on.
  it('passes className through to the rendered element', () => {
    const html = renderToStaticMarkup(
      createElement(Reveal, { className: 'h-full' }, createElement('p', null, 'card')),
    );

    expect(html).toContain('h-full');
  });
});
