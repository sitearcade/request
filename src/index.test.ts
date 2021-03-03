// import

import fetchMock from 'jest-fetch-mock';

import type {ParsedResponse} from './index';
import request from './index';

// vars

const sampleRes = {status: 'ok'};

// test

beforeAll(() => {
  fetchMock.enableMocks();
});

describe('request(opts)', () => {
  it('sends request and receives response using default opts', async () => {
    fetchMock.once(JSON.stringify(sampleRes));
    const res = await request({path: 'https://www.example.com'});

    expect(res).toMatchObject({
      status: 200,
      statusText: 'OK',
      body: {status: 'ok'},
    });
  });

  it('returns errors with a certain shape', async () => {
    fetchMock.once(JSON.stringify(sampleRes), {status: 404});

    try {
      await request({path: 'https://www.error.com'});
    } catch (err) {
      expect(err.toString()).toStrictEqual('Error: 404 Not Found');
      expect(err.url).toStrictEqual('https://www.error.com');
      expect(err.request).toMatchObject({
        body: undefined,
        credentials: 'include',
        method: 'GET',
        mode: 'no-cors',
      });
      expect(err.response).toMatchObject({
        body: {status: 'ok'}, status: 404,
      });
    }
  });
});

describe('request(url, opts)', () => {
  it('supports alternative signature', async () => {
    fetchMock.once(JSON.stringify(sampleRes));
    const res = await request('https://www.example.com', {body: null});

    expect(res).toMatchObject({
      status: 200,
      statusText: 'OK',
      body: {status: 'ok'},
    });
  });

  it('handles AbortSignal properly', async () => {
    const c = new AbortController();
    const res = await request('/', {signal: c.signal});

    expect((res as ParsedResponse).body).toBeNull();

    c.abort();

    try {
      await request('/', {signal: c.signal});
    } catch (err) {
      expect(err.toString())
        .toStrictEqual('AbortError: The operation was aborted. ');
    }
  });

  it('can timeout after specific duration', async () => {
    jest.useFakeTimers();

    fetchMock.once(JSON.stringify(sampleRes));
    const res = await request('https://www.example.com', {
      useJson: true,
      timeout: 0,
    });

    expect(res).toMatchObject({
      status: 200,
      statusText: 'OK',
      body: {status: 'ok'},
    });

    fetchMock.once(async () => {
      jest.advanceTimersByTime(10);

      return JSON.stringify(sampleRes);
    });

    try {
      await request('https://www.example.com', {
        useJson: true,
        timeout: 1,
      });
    } catch (err) {
      expect(err.toString())
        .toStrictEqual('AbortError: The operation was aborted. ');
    }

    jest.useRealTimers();
  });
});

describe('request.extend(defs)', () => {
  it('creates new requester with updated defaults', async () => {
    const req = request.extend({
      useJson: true,
      useCors: true,
      onlyBody: true,
    });

    fetchMock.once(JSON.stringify(sampleRes));
    const res = await req({path: 'https://www.example.com'});

    expect(res).toMatchObject({status: 'ok'});

    fetchMock.once(JSON.stringify(sampleRes), {status: 404});

    try {
      await req({path: 'https://www.error.com'});
    } catch (err) {
      expect(err.toString()).toStrictEqual('Error: 404 Not Found');
      expect(err.url).toStrictEqual('https://www.error.com');
      expect(err.request).toMatchObject({
        body: undefined,
        credentials: 'omit',
        method: 'GET',
        mode: 'cors',
      });
      expect(err.response).toMatchObject({
        body: {status: 'ok'}, status: 404,
      });
    }
  });

  it('also supports alternative signature', async () => {
    const req = request.extend();

    fetchMock.once(JSON.stringify(sampleRes));
    const res = await req('https://www.example.com');

    expect((res as ParsedResponse).headers.get('Content-Type'))
      .toStrictEqual('text/plain;charset=UTF-8');
    expect(res).toMatchObject({
      status: 200,
      statusText: 'OK',
      body: {status: 'ok'},
    });

    fetchMock.once(JSON.stringify(sampleRes));
    const altRes = await req('https://www.example.com', {useJson: true});

    expect((res as ParsedResponse).headers.get('Content-Type'))
      .toStrictEqual('text/plain;charset=UTF-8');
    expect(altRes).toMatchObject({
      status: 200,
      statusText: 'OK',
      body: {status: 'ok'},
    });
  });
});
