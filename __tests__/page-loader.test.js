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
import { downloadingDirName } from '../src/utils.js';

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
    const sleep = (ms) => new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
    const waitForFile = async (filePath, timeout = 1000, interval = 100) => {
      const start = Date.now();
      const checkFile = async () => {
        try {
          await fs.promises.access(filePath);
          return true;
        } catch {
          if (Date.now() - start >= timeout) {
            return false;
          }
          await sleep(interval);
          return checkFile();
        }
      };
      return checkFile();
    };
    test('should create file in specified directory', async () => {
      const filepath = path.join(tempdir, EXPECTED_FILENAME);
      await getFileFromURL(TEST_URL, tempdir);
      const fileExists = await waitForFile(filepath);
      expect(fileExists).toBe(true);
    });
    test('should fail gracefully when URL is invalid', async () => {
      const invalidURL = 'https://invalid-url.com';
      nock('https://invalid-url.com')
        .persist()
        .get(/.*/)
        .reply(404);
      await expect(getFileFromURL(invalidURL, tempdir))
        .rejects
        .toThrow();
    });
  });
  describe('error handling', () => {
    test('shows error message if webpage is not available', async () => {
      const testUrl = 'https://example.com/broken';
      const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
      // Interceptamos la solicitud y devolvemos un error
      nock('https://example.com')
        .get('/broken')
        .reply(404);
      await expect(getFileFromURL(testUrl, tmpDir)).rejects.toThrow();
    });
  });
  describe('HTML modification', () => {
    test('should correctly modify and save HTML content', async () => {
      await getFileFromURL(TEST_URL, tempdir);
      const assetsDir = downloadingDirName(TEST_URL);
      const filepath = path.join(tempdir, assetsDir, EXPECTED_FILENAME);
      const result = await fs.promises.readFile(filepath, 'utf8');
      const $ = cheerio.load(result);
      const resources = [];
      $('img, script, link[rel="stylesheet"]').each((_, el) => {
        const attr = el.name === 'link' ? 'href' : 'src';
        const value = $(el).attr(attr);
        if (value && !value.startsWith('http')) {
          resources.push(value);
        }
      });
      expect(resources.length).toBeGreaterThan(0);
      resources.forEach((val) => {
        expect(val).toMatch(new RegExp(`^${downloadingDirName(TEST_URL)}/`));
      });
    });
  });
  describe('images downloading', () => {
    test('should download images to specified directory', async () => {
      await getFileFromURL(TEST_URL, tempdir);
      const $ = cheerio.load(expectedContent);
      const urls = [];
      const validateAttributes = (tagname, attr) => {
        $(tagname).each((_, el) => {
          const original = $(el).attr(attr);
          if (original) {
            urls.push(original);
          }
        });
      };
      validateAttributes('img', 'src');
      validateAttributes('script', 'src');
      validateAttributes('link', 'href');
      expect(urls.length).toBeGreaterThan(0);
    });
  });
});
