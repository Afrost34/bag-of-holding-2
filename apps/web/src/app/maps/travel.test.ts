import { describe, expect, it } from 'vitest';
import {
  formatDistance,
  formatDuration,
  measureLine,
  scaleForWidth,
  scaledDistance,
  travelTimes,
  DEFAULT_SPEEDS,
  routeLength,
  speedsOf,
} from './travel';

describe('map scale and travel', () => {
  const scale = scaleForWidth(4096, 9900, 'km');
  const speeds = [
    { name: 'Merchant skyship', perDay: 960 },
    { name: 'Skiff', perDay: 1400 },
  ];

  it('measures in the map’s unit', () => {
    expect(scale.perPixel).toBeCloseTo(2.417, 3);
    expect(scaledDistance({ x: 0, y: 0 }, { x: 300, y: 400 }, scale)).toBeCloseTo(1208.5, 0);
    expect(formatDistance(1920.4, 'km')).toBe('1,920 km');
    expect(formatDistance(12.54, 'mi')).toBe('12.5 mi');
    expect(formatDistance(0.8, 'km')).toBe('800 m');
  });

  it('says how long each way of travelling takes', () => {
    expect(formatDuration(2)).toBe('2 days');
    expect(formatDuration(1)).toBe('1 day');
    expect(formatDuration(1.37)).toBe('1.4 days');
    expect(formatDuration(0.3)).toBe('about 7 hours');
    expect(formatDuration(0.01)).toBe('under an hour');
    expect(travelTimes(1920, speeds)).toEqual([
      { name: 'Merchant skyship', time: '2 days' },
      { name: 'Skiff', time: '1.4 days' },
    ]);
    expect(measureLine({ x: 0, y: 0 }, { x: 3, y: 4 }, { unit: 'mi', perPixel: 4.8 }, [])).toBe(
      '24 mi · On foot: 1 day',
    );
  });
});

describe('routes', () => {
  it('add up their legs, and fall back to walking speed', () => {
    const scale = { unit: 'km' as const, perPixel: 2 };
    expect(routeLength([0, 0, 30, 40, 30, 140], scale)).toBe(300);
    expect(routeLength([5, 5], scale)).toBe(0);
    expect(speedsOf(scale, undefined)).toEqual(DEFAULT_SPEEDS.km);
    expect(speedsOf(scale, [{ name: 'Skyship', perDay: 900 }])[0]?.name).toBe('Skyship');
  });
});
