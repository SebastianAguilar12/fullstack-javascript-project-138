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
import { downloadingDirName, makeDashedFileName } from '../src/utils.js';

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
    const waitForFile = async (filePath, timeout = 1000, interval = 100) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        try {
          await fs.promises.access(filePath);
          return true;
        } catch {
          await new Promise((res) => setTimeout(res, interval));
        }
      }
      return false;
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
        .get('/')
        .reply(404);
      await expect(getFileFromURL(invalidURL, tempdir))
        .rejects
        .toThrow();
    });
  });
  describe('HTML modification', () => {
    test('should correctly modify and save HTML content', async () => {
      const url = new URL(TEST_URL);
      await getFileFromURL(TEST_URL, tempdir);
      const filepath = path.join(tempdir, EXPECTED_FILENAME);
      const result = await fs.promises.readFile(filepath, 'utf8');
      const $el = cheerio.load(result);
      const getAttrValue = (tagname, attr) => $el(tagname).attr(attr);
      let baseName = path.basename(url.pathname);
      if (baseName === '') {
        baseName = 'index.html';
      } else {
        baseName = `${baseName}`;
      }
      const ext = path.extname(baseName);
      const nameWithoutExt = baseName.replace(ext, '');
      const slug = `${makeDashedFileName(`${url.hostname}-${nameWithoutExt}`)}${ext}`;
      const assetsFolder = downloadingDirName(TEST_URL);
      expect(getAttrValue('link', 'href')).toBe(path.join(assetsFolder, slug));
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
