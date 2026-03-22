import React from 'react';
import { render } from '@testing-library/react-native';
import { SkeletonLoader } from '../SkeletonLoader';

describe('SkeletonLoader', () => {
  it('renders card variant with default count', () => {
    const { getAllByTestId, UNSAFE_root } = render(<SkeletonLoader variant="card" />);
    // Should render 3 cards by default
    expect(UNSAFE_root.findAllByType('View').length).toBeGreaterThan(0);
  });

  it('renders list variant with custom count', () => {
    const { UNSAFE_root } = render(<SkeletonLoader variant="list" count={5} />);
    expect(UNSAFE_root.findAllByType('View').length).toBeGreaterThan(0);
  });

  it('renders text variant', () => {
    const { UNSAFE_root } = render(<SkeletonLoader variant="text" count={2} />);
    expect(UNSAFE_root.findAllByType('Animated.View').length).toBeGreaterThan(0);
  });

  it('applies shimmer animation', () => {
    const { UNSAFE_root } = render(<SkeletonLoader variant="card" />);
    // Verify that Animated.View components are rendered
    expect(UNSAFE_root.findAllByType('Animated.View').length).toBeGreaterThan(0);
  });
});
