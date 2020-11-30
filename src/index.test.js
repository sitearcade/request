// import

import {fetchMock} from '@sitearcade/jest-preset/tools';
import * as R from 'ramda';

import request from './index';

// vars

const sampleRes = {status: 'ok'};

// test

beforeAll(() => {
  fetchMock.enableMocks();
});

describe('request(opts)', () => {
  it('sends request and receives response using default opts', async () => {
    fetch.once(JSON.stringify(sampleRes));
    const res = await request({path: 'https://www.example.com'});

    expect(res).toMatchInlineSnapshot(`
      Object {
        "body": Object {
          "status": "ok",
        },
        "headers": Headers {
          Symbol(map): Object {
            "Content-Type": Array [
              "text/plain;charset=UTF-8",
            ],
          },
        },
        "status": 200,
      }
    `);
  });

  it('returns errors with a certain shape', async () => {
    fetch.once(JSON.stringify(sampleRes), {ok: false, status: 404});
    const err = await request({path: 'https://www.error.com'}).catch(
      R.identity,
    );

    expect(err).toMatchInlineSnapshot('[Error: 404 Not Found]');
    expect(err.request).toMatchInlineSnapshot(`
        Object {
          "body": undefined,
          "credentials": "include",
          "headers": Object {},
          "method": "GET",
          "url": "https://www.error.com",
        }
      `);
    expect(err.response).toMatchInlineSnapshot(`
        Object {
          "body": Object {
            "status": "ok",
          },
          "headers": Headers {
            Symbol(map): Object {
              "Content-Type": Array [
                "text/plain;charset=UTF-8",
              ],
            },
          },
          "status": 404,
        }
      `);
  });
});

describe('request(url, opts)', () => {
  it('supports alternative signature', async () => {
    fetch.once(JSON.stringify(sampleRes));
    const res = await request('https://www.example.com', {body: {}});

    expect(res).toMatchInlineSnapshot(`
      Object {
        "body": Object {
          "status": "ok",
        },
        "headers": Headers {
          Symbol(map): Object {
            "Content-Type": Array [
              "text/plain;charset=UTF-8",
            ],
          },
        },
        "status": 200,
      }
    `);
  });

  it('handles AbortSignal properly', async () => {
    const c = new AbortController();

    const res = await request('/', {signal: c.signal});

    expect(res.body).toBeNull();

    c.abort();

    const err = await request('/', {signal: c.signal}).catch(R.identity);

    expect(err).toMatchInlineSnapshot('[AbortError: The operation was aborted. ]');
  });

  it('can timeout after specific duration', async () => {
    jest.useFakeTimers();

    fetch.once(JSON.stringify(sampleRes));
    const t0 = await request('https://www.example.com', {
      useJson: true,
      timeout: 0,
    });

    expect(t0).toMatchInlineSnapshot(`
      Object {
        "body": Object {
          "status": "ok",
        },
        "headers": Headers {
          Symbol(map): Object {
            "Content-Type": Array [
              "text/plain;charset=UTF-8",
            ],
          },
        },
        "status": 200,
      }
    `);

    fetch.once(async () => {
      jest.advanceTimersByTime(10);

      return JSON.stringify(sampleRes);
    });
    const t1 = await request('https://www.example.com', {
      useJson: true,
      timeout: 1,
    }).catch(R.identity);

    expect(t1).toMatchInlineSnapshot('[AbortError: The operation was aborted. ]');

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

    fetch.once(JSON.stringify(sampleRes));
    const res = await req({path: 'https://www.example.com'});

    expect(res).toMatchInlineSnapshot(`
      Object {
        "status": "ok",
      }
    `);

    fetch.once(JSON.stringify(sampleRes), {ok: false, status: 404});
    const err = await req({path: 'https://www.error.com'}).catch(R.identity);

    expect(err).toMatchInlineSnapshot('[Error: 404 Not Found]');
    expect(err.request).toMatchInlineSnapshot(`
      Object {
        "body": undefined,
        "credentials": undefined,
        "headers": Object {
          "Accept": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        "method": "GET",
        "url": "https://www.error.com",
      }
    `);
    expect(err.response).toMatchInlineSnapshot(`
      Object {
        "body": Object {
          "status": "ok",
        },
        "headers": Headers {
          Symbol(map): Object {
            "Content-Type": Array [
              "text/plain;charset=UTF-8",
            ],
          },
        },
        "status": 404,
      }
    `);
  });

  it('also supports alternative signature', async () => {
    const req = request.extend();

    fetch.once(JSON.stringify(sampleRes));
    const res = await req('https://www.example.com');

    expect(res).toMatchInlineSnapshot(`
      Object {
        "body": Object {
          "status": "ok",
        },
        "headers": Headers {
          Symbol(map): Object {
            "Content-Type": Array [
              "text/plain;charset=UTF-8",
            ],
          },
        },
        "status": 200,
      }
    `);

    fetch.once(JSON.stringify(sampleRes));
    const altRes = await req('https://www.example.com', {useJson: true});

    expect(altRes).toMatchInlineSnapshot(`
      Object {
        "body": Object {
          "status": "ok",
        },
        "headers": Headers {
          Symbol(map): Object {
            "Content-Type": Array [
              "text/plain;charset=UTF-8",
            ],
          },
        },
        "status": 200,
      }
    `);
  });
});
