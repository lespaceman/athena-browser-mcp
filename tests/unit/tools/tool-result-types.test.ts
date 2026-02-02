/**
 * Tool Result Types Tests
 */
import { describe, it, expect } from 'vitest';
import {
  isImageResult,
  isFileResult,
  type ImageResult,
  type FileResult,
} from '../../../src/tools/tool-result.types.js';

describe('isImageResult', () => {
  it('should return true for valid ImageResult', () => {
    const result: ImageResult = {
      type: 'image',
      data: 'base64data',
      mimeType: 'image/png',
      sizeBytes: 1024,
    };
    expect(isImageResult(result)).toBe(true);
  });

  it('should return false for FileResult', () => {
    const result: FileResult = {
      type: 'file',
      path: '/tmp/test.png',
      mimeType: 'image/png',
      sizeBytes: 1024,
    };
    expect(isImageResult(result)).toBe(false);
  });

  it('should return false for plain string', () => {
    expect(isImageResult('<xml>text</xml>')).toBe(false);
  });

  it('should return false for null', () => {
    expect(isImageResult(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isImageResult(undefined)).toBe(false);
  });

  it('should return false for objects missing required fields', () => {
    expect(isImageResult({ type: 'image' })).toBe(false);
    expect(isImageResult({ type: 'image', data: 'abc' })).toBe(false);
  });
});

describe('isFileResult', () => {
  it('should return true for valid FileResult', () => {
    const result: FileResult = {
      type: 'file',
      path: '/tmp/screenshot.png',
      mimeType: 'image/png',
      sizeBytes: 2048,
    };
    expect(isFileResult(result)).toBe(true);
  });

  it('should return false for ImageResult', () => {
    const result: ImageResult = {
      type: 'image',
      data: 'base64',
      mimeType: 'image/jpeg',
      sizeBytes: 512,
    };
    expect(isFileResult(result)).toBe(false);
  });

  it('should return false for plain string', () => {
    expect(isFileResult('some text')).toBe(false);
  });

  it('should return false for null', () => {
    expect(isFileResult(null)).toBe(false);
  });

  it('should return false for objects missing required fields', () => {
    expect(isFileResult({ type: 'file' })).toBe(false);
    expect(isFileResult({ type: 'file', path: '/tmp' })).toBe(false);
  });
});
