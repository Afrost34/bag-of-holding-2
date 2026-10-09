import { describe, expect, it } from 'vitest';
import { dataUrlBytes, pictureFileName, pictureName, picturePathOf, pictureRef } from './model';

describe('picture library', () => {
  it('refers to pictures by path', () => {
    const ref = pictureRef('pictures/Clive.webp');
    expect(ref).toBe('picture:pictures/Clive.webp');
    expect(picturePathOf(ref)).toBe('pictures/Clive.webp');
    expect(picturePathOf('art:races/XPHB/Elf.webp')).toBeNull();
    expect(picturePathOf(undefined)).toBeNull();
    expect(pictureName('pictures/Clive.webp')).toBe('Clive');
  });

  it('names files after the picture, never twice the same', () => {
    expect(pictureFileName('Clive portrait.PNG', [], 'webp')).toBe('Clive portrait.webp');
    expect(pictureFileName('a/b:c.jpg', [], 'webp')).toBe('a-b-c.webp');
    expect(pictureFileName('Clive.png', ['clive.webp', 'Clive 2.webp'], 'webp')).toBe(
      'Clive 3.webp',
    );
  });

  it('reads data URLs as bytes', () => {
    const { bytes, ext } = dataUrlBytes('data:image/webp;base64,AAEC');
    expect(ext).toBe('webp');
    expect([...bytes]).toEqual([0, 1, 2]);
    expect(dataUrlBytes('data:image/jpeg;base64,AA==').ext).toBe('jpg');
  });
});
