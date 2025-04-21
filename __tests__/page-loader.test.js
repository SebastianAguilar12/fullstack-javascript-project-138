import * as fs from 'fs';
import path from 'node:path';
import nock from 'nock';
import os from 'node:os';
import {
  expect,
  describe,
  beforeEach,
  afterEach,
  test,
} from '@jest/globals';
import * as cheerio from 'cheerio';
import getFileFromURL from '../src/index.js';

describe('getFileFromURL', () => {
  let tempdir;
  let expectedContent = '';
  let pathToFile = '';
  const TEST_URL = 'https://codica.la/cursos';
  const EXPECTED_FILENAME = 'codica-la-cursos.html';
  beforeEach(async () => {
    const currentDir = process.cwd();
    pathToFile = path.join(currentDir, '__fixtures__', 'expectedFileContent.html');
    expectedContent = await fs.promises.readFile(pathToFile, 'utf8');
    // Setup temp directory
    tempdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), '/'));
    // Setup mock response
    // Setup nock interceptor
    nock('https://codica.la')
      .persist()
      .get('/cursos')
      .reply(200, expectedContent);
  });
  afterEach(async () => {
    // Cleanup
    nock.cleanAll();
    await fs.promises.rm(tempdir, { recursive: true, force: true });
  });
  describe('file creation', () => {
    test('should create file in specified directory', async () => {
      const filepath = path.join(tempdir, EXPECTED_FILENAME);
      await getFileFromURL(TEST_URL, tempdir);
      await fs.promises.access(filepath);
      expect(true).toBeTruthy();
    });
    test('should fail gracefully when URL is invalid', async () => {
      const invalidURL = 'https://invalid-url.com';
      nock('https://invalid-url.com')
        .get('/')
        .reply(404);
      await expect(getFileFromURL(invalidURL, tempdir))
        .rejects
        .toThrow();
    });
  });
  describe('file content', () => {
    test('should match expected content after HTML update', async () => {
      const filepath = path.join(tempdir, EXPECTED_FILENAME);
      await getFileFromURL(TEST_URL, tempdir);
      const result = await fs.promises.readFile(filepath, 'utf8');
      const $ = cheerio.load(expectedContent);
      const imagesDir = path.join(tempdir, 'codica-la-cursos_files');
      $('img').each((_, el) => {
        const original = $(el).attr('data-original');
        const name = original?.split('/').pop();
        if (name) {
          $(el).attr('data-original', path.join(imagesDir, name));
        }
      });
      const modifiedExpectedContent = $.html().trim();
      expect(result).toBe(modifiedExpectedContent);
    });
  });
  describe('HTML modification', () => {
    test('should correctly modify and save HTML content', async () => {
      const fileHTML = await getFileFromURL(TEST_URL, tempdir);
      const resultFileHTML = await fs.promises.readFile(fileHTML, 'utf8');
      const $ = cheerio.load(expectedContent);
      const imagesDir = path.join(tempdir, 'codica-la-cursos_files');
      $('img').each((_, el) => {
        const original = $(el).attr('data-original');
        const name = original?.split('/').pop();
        if (name) {
          $(el).attr('data-original', path.join(imagesDir, name));
        }
      });
      const modifiedExpectedContent = $.html();
      expect(resultFileHTML).toBe(modifiedExpectedContent);
    });
  });
  describe('images downloading', () => {
    test('should download images to specified directory', async () => {
      await getFileFromURL(TEST_URL, tempdir);
      const imagesDir = path.join(tempdir, 'codica-la-cursos_files');
      const images = await fs.promises.readdir(imagesDir);
      console.log(images);
      expect(images.length).toBeGreaterThan(0);
    });
  })
});
