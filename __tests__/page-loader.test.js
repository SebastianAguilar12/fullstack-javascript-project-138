import * as fs from 'fs';
import path from 'node:path';
import nock from 'nock';
import os from 'node:os';
import axios from 'axios';
import {
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import getFileFromURL from '../src/index.js';

let tempdir = '';
let expectedContent = '';
beforeEach(async () => {
  const tmpdir = os.tmpdir();
  tempdir = await fs.promises.mkdtemp(path.join(tmpdir, '/'));
  expectedContent = await axios.get('https://codica.la/cursos').then((response) => response.data);
  nock('https://codica.la')
    .persist()
    .get('/cursos')
    .reply(200, expectedContent)
    .on('request', (req) => {
      console.log(`request to ${req.url} was made`);
    });
});
afterEach(async () => {
  nock.cleanAll();
  await fs.promises.rm(tempdir, { recursive: true, force: true });
});
test('file should exist', async () => {
  await getFileFromURL('https://codica.la/cursos', tempdir);
  const filepath = path.join(tempdir, 'codica-la-cursos.html');
  try {
    await fs.promises.access(filepath);
    expect(true).toBeTruthy();
  } catch (err) {
    expect(err).toBeFalsy();
  }
});
test('file content should be the same', async () => {
  await getFileFromURL('https://codica.la/cursos', tempdir);
  const filepath = path.join(tempdir, 'codica-la-cursos.html');
  const result = await fs.promises.readFile(filepath, 'utf8');
  expect(result).toBe(expectedContent);
});
